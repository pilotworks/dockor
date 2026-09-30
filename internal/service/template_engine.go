package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/pilotworks/dockor/internal/models"
	"gopkg.in/yaml.v3"
)

type TemplateEngine struct {
	templatesDir string
}

func NewTemplateEngine(templatesDir string) *TemplateEngine {
	return &TemplateEngine{
		templatesDir: templatesDir,
	}
}

// LoadTemplates scans the templates directory and loads all templates
func (te *TemplateEngine) LoadTemplates() ([]models.Template, error) {
	var templates []models.Template

	if _, err := os.Stat(te.templatesDir); os.IsNotExist(err) {
		return templates, nil
	}

	entries, err := os.ReadDir(te.templatesDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read templates directory: %w", err)
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		tmplPath := filepath.Join(te.templatesDir, entry.Name())
		manifestPath := filepath.Join(tmplPath, "dockor.yaml")
		composePath := filepath.Join(tmplPath, "docker-compose.yml")

		if _, err := os.Stat(manifestPath); err != nil {
			// Check if standard docker-compose.yml exists without dockor.yaml
			if _, err := os.Stat(composePath); err == nil {
				// Synthesize minimal template
				templates = append(templates, models.Template{
					Metadata: models.TemplateMetadata{
						ID:          entry.Name(),
						Name:        strings.Title(entry.Name()),
						Version:     "latest",
						Description: fmt.Sprintf("Compose stack for %s", entry.Name()),
						Category:    "General",
					},
					Path: tmplPath,
				})
			}
			continue
		}

		manifestData, err := os.ReadFile(manifestPath)
		if err != nil {
			continue
		}

		var tmpl models.Template
		if err := yaml.Unmarshal(manifestData, &tmpl); err != nil {
			continue
		}

		if _, err := os.Stat(composePath); err == nil {
			composeData, err := os.ReadFile(composePath)
			if err == nil {
				tmpl.ComposeYAML = string(composeData)
			}
		}

		tmpl.Path = tmplPath
		if tmpl.Metadata.ID == "" {
			tmpl.Metadata.ID = entry.Name()
		}

		templates = append(templates, tmpl)
	}

	return templates, nil
}

// GetTemplateByID finds a single template by ID
func (te *TemplateEngine) GetTemplateByID(id string) (*models.Template, error) {
	templates, err := te.LoadTemplates()
	if err != nil {
		return nil, err
	}

	for _, t := range templates {
		if t.Metadata.ID == id {
			return &t, nil
		}
	}

	return nil, fmt.Errorf("template with id '%s' not found", id)
}

type EvaluationResult struct {
	EvaluatedVariables map[string]interface{} `json:"evaluated_variables"`
	Warnings           []string               `json:"warnings"`
	RenderedCompose    string                 `json:"rendered_compose"`
}

// Evaluate evaluates and resolves template variables, generators, and port conflicts
func (te *TemplateEngine) Evaluate(tmpl *models.Template, userInputs map[string]interface{}) (*EvaluationResult, error) {
	result := &EvaluationResult{
		EvaluatedVariables: make(map[string]interface{}),
		Warnings:           make([]string, 0),
	}

	for _, v := range tmpl.Variables {
		var val interface{}
		if inputVal, exists := userInputs[v.Name]; exists && inputVal != nil && inputVal != "" {
			val = inputVal
		} else if v.Default != nil {
			val = v.Default
		}

		// Handle secret generator
		if v.Type == models.VarTypeSecret && (val == nil || val == "") {
			generated, err := generateSecret(v.Generator)
			if err != nil {
				generated = generateRandomString(24, "alphanumeric")
			}
			val = generated
		}

		// Handle port conflict detection & resolution
		if v.Type == models.VarTypePort {
			portNum := 0
			switch p := val.(type) {
			case int:
				portNum = p
			case float64:
				portNum = int(p)
			case string:
				portNum, _ = strconv.Atoi(p)
			}

			if portNum > 0 && v.PortConfig != nil && v.PortConfig.AutoResolveConflict {
				if isPortInUse(portNum) {
					resolvedPort := findNextAvailablePort(portNum)
					result.Warnings = append(result.Warnings, fmt.Sprintf("Port %d was in use; automatically assigned available port %d for %s", portNum, resolvedPort, v.Label))
					val = resolvedPort
				}
			}
		}

		result.EvaluatedVariables[v.Name] = val
	}

	// Render Compose template
	rendered := tmpl.ComposeYAML
	for k, v := range result.EvaluatedVariables {
		strVal := fmt.Sprintf("%v", v)
		// Support Go template syntax {{ .VAR }}
		rendered = strings.ReplaceAll(rendered, fmt.Sprintf("{{ .%s }}", k), strVal)
		// Support standard compose syntax ${VAR}
		rendered = strings.ReplaceAll(rendered, fmt.Sprintf("${%s}", k), strVal)
	}
	result.RenderedCompose = rendered

	return result, nil
}

func isPortInUse(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return true
	}
	_ = ln.Close()
	return false
}

func findNextAvailablePort(startPort int) int {
	for port := startPort + 1; port < 65535; port++ {
		if !isPortInUse(port) {
			return port
		}
	}
	return startPort
}

func generateSecret(generator string) (string, error) {
	if generator == "uuid" {
		return uuid.New().String(), nil
	}

	re := regexp.MustCompile(`random_string\((\d+)(?:,\s*charset=(\w+))?\)`)
	matches := re.FindStringSubmatch(generator)
	if len(matches) > 1 {
		length, _ := strconv.Atoi(matches[1])
		charset := "alphanumeric"
		if len(matches) > 2 && matches[2] != "" {
			charset = matches[2]
		}
		return generateRandomString(length, charset), nil
	}

	reHex := regexp.MustCompile(`hex\((\d+)\)`)
	matchesHex := reHex.FindStringSubmatch(generator)
	if len(matchesHex) > 1 {
		bytesLen, _ := strconv.Atoi(matchesHex[1])
		b := make([]byte, bytesLen)
		_, _ = rand.Read(b)
		return hex.EncodeToString(b), nil
	}

	return generateRandomString(32, "alphanumeric"), nil
}

func generateRandomString(length int, charsetType string) string {
	const alphanumeric = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	const symbols = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+"

	chars := alphanumeric
	if charsetType == "symbols" {
		chars = symbols
	}

	result := make([]byte, length)
	charsLen := big.NewInt(int64(len(chars)))
	for i := 0; i < length; i++ {
		idx, _ := rand.Int(rand.Reader, charsLen)
		result[i] = chars[idx.Int64()]
	}
	return string(result)
}

func (te *TemplateEngine) SaveCustomTemplate(tmpl *models.Template) error {
	if tmpl.Metadata.ID == "" {
		if tmpl.Metadata.Name != "" {
			reg := regexp.MustCompile("[^a-zA-Z0-9_-]+")
			tmpl.Metadata.ID = strings.ToLower(reg.ReplaceAllString(tmpl.Metadata.Name, "-"))
		} else {
			tmpl.Metadata.ID = "tmpl-" + uuid.New().String()[:8]
		}
	}

	targetDir := filepath.Join(te.templatesDir, tmpl.Metadata.ID)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("failed to create template directory: %w", err)
	}

	// Write dockor.yaml
	manifest := models.Template{
		Metadata:  tmpl.Metadata,
		Variables: tmpl.Variables,
	}
	manifestBytes, err := yaml.Marshal(manifest)
	if err != nil {
		return fmt.Errorf("failed to serialize dockor.yaml: %w", err)
	}
	if err := os.WriteFile(filepath.Join(targetDir, "dockor.yaml"), manifestBytes, 0644); err != nil {
		return fmt.Errorf("failed to write dockor.yaml: %w", err)
	}

	// Write docker-compose.yml
	composeYAML := tmpl.ComposeYAML
	if strings.TrimSpace(composeYAML) == "" {
		composeYAML = "services:\n  app:\n    image: nginx:alpine\n    restart: unless-stopped\n"
	}
	if err := os.WriteFile(filepath.Join(targetDir, "docker-compose.yml"), []byte(composeYAML), 0644); err != nil {
		return fmt.Errorf("failed to write docker-compose.yml: %w", err)
	}

	return nil
}

type portainerTemplate struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Note        string   `json:"note"`
	Categories  []string `json:"categories"`
	Platform    string   `json:"platform"`
	Logo        string   `json:"logo"`
	Image       string   `json:"image"`
	Env         []struct {
		Name        string `json:"name"`
		Label       string `json:"label"`
		Default     string `json:"default"`
		Description string `json:"description"`
	} `json:"env"`
	Repository struct {
		URL       string `json:"url"`
		StackFile string `json:"stackfile"`
	} `json:"repository"`
}

type portainerCatalogWrapper struct {
	Version   string              `json:"version"`
	Templates []portainerTemplate `json:"templates"`
}

func (te *TemplateEngine) ImportCatalogFromURL(urlStr string) (int, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(urlStr)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch catalog: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("catalog returned HTTP status %d", resp.StatusCode)
	}

	var raw json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return 0, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	count := 0
	// 1. Try decoding as portainer catalog wrapper { "version": "...", "templates": [...] }
	var catalog portainerCatalogWrapper
	if err := json.Unmarshal(raw, &catalog); err == nil && len(catalog.Templates) > 0 {
		for _, pt := range catalog.Templates {
			if strings.TrimSpace(pt.Title) == "" {
				continue
			}
			reg := regexp.MustCompile("[^a-zA-Z0-9_-]+")
			id := strings.ToLower(reg.ReplaceAllString(pt.Title, "-"))
			if id == "" {
				id = "pt-" + uuid.New().String()[:8]
			}

			catName := "General"
			if len(pt.Categories) > 0 && pt.Categories[0] != "" {
				catName = pt.Categories[0]
			}

			var vars []models.TemplateVariable
			for _, e := range pt.Env {
				vars = append(vars, models.TemplateVariable{
					Name:        e.Name,
					Label:       e.Label,
					Type:        models.VarTypeString,
					Default:     e.Default,
					Description: e.Description,
				})
			}

			var compose string
			if pt.Image != "" {
				compose = fmt.Sprintf("services:\n  %s:\n    image: %s\n    restart: unless-stopped\n", id, pt.Image)
			} else {
				compose = "services:\n  app:\n    image: nginx:alpine\n    restart: unless-stopped\n"
			}

			tmpl := models.Template{
				Metadata: models.TemplateMetadata{
					ID:          id,
					Name:        pt.Title,
					Description: pt.Description,
					Category:    catName,
					Icon:        pt.Logo,
					Version:     "latest",
				},
				Variables:   vars,
				ComposeYAML: compose,
			}
			_ = te.SaveCustomTemplate(&tmpl)
			count++
		}
		return count, nil
	}

	// 2. Try decoding as direct list of templates []portainerTemplate or []models.Template
	var ptList []portainerTemplate
	if err := json.Unmarshal(raw, &ptList); err == nil && len(ptList) > 0 {
		for _, pt := range ptList {
			if strings.TrimSpace(pt.Title) == "" {
				continue
			}
			reg := regexp.MustCompile("[^a-zA-Z0-9_-]+")
			id := strings.ToLower(reg.ReplaceAllString(pt.Title, "-"))
			if id == "" {
				id = "pt-" + uuid.New().String()[:8]
			}

			catName := "General"
			if len(pt.Categories) > 0 && pt.Categories[0] != "" {
				catName = pt.Categories[0]
			}

			tmpl := models.Template{
				Metadata: models.TemplateMetadata{
					ID:          id,
					Name:        pt.Title,
					Description: pt.Description,
					Category:    catName,
					Icon:        pt.Logo,
					Version:     "latest",
				},
				ComposeYAML: fmt.Sprintf("services:\n  %s:\n    image: %s\n    restart: unless-stopped\n", id, pt.Image),
			}
			_ = te.SaveCustomTemplate(&tmpl)
			count++
		}
		return count, nil
	}

	return 0, fmt.Errorf("unrecognized catalog format")
}

