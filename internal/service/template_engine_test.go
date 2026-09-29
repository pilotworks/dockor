package service

import (
	"fmt"
	"net"
	"testing"

	"github.com/pilotworks/dockor/internal/models"
)

func TestEvaluateVariablesAndGenerators(t *testing.T) {
	eng := NewTemplateEngine("../../templates")

	tmpl := &models.Template{
		Metadata: models.TemplateMetadata{
			ID:   "test-tmpl",
			Name: "Test Template",
		},
		Variables: []models.TemplateVariable{
			{
				Name:      "DB_PASS",
				Label:     "Database Password",
				Type:      models.VarTypeSecret,
				Generator: "random_string(16, charset=alphanumeric)",
			},
			{
				Name:    "APP_PORT",
				Label:   "Web Port",
				Type:    models.VarTypePort,
				Default: 8080,
				PortConfig: &models.PortConfig{
					AutoResolveConflict: true,
				},
			},
			{
				Name:    "APP_NAME",
				Label:   "Application Name",
				Type:    models.VarTypeString,
				Default: "MyApp",
			},
		},
		ComposeYAML: `version: "3.8"
services:
  app:
    image: nginx:alpine
    ports:
      - "{{ .APP_PORT }}:80"
    environment:
      - DB_PASS={{ .DB_PASS }}
      - APP_NAME={{ .APP_NAME }}`,
	}

	// 1. Evaluate with defaults and generators
	res, err := eng.Evaluate(tmpl, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	pass, ok := res.EvaluatedVariables["DB_PASS"].(string)
	if !ok || len(pass) != 16 {
		t.Errorf("expected 16-char generated password, got: %v", pass)
	}

	port := res.EvaluatedVariables["APP_PORT"]
	if port != 8080 {
		t.Errorf("expected port 8080, got: %v", port)
	}

	if res.EvaluatedVariables["APP_NAME"] != "MyApp" {
		t.Errorf("expected APP_NAME to be 'MyApp'")
	}
}

func TestPortConflictResolution(t *testing.T) {
	eng := NewTemplateEngine("../../templates")

	// Bind port 8999 to simulate an active conflicting service
	ln, err := net.Listen("tcp", "127.0.0.1:8999")
	if err != nil {
		t.Skipf("cannot bind test port 8999: %v", err)
	}
	defer ln.Close()

	tmpl := &models.Template{
		Variables: []models.TemplateVariable{
			{
				Name:    "PORT",
				Label:   "Port",
				Type:    models.VarTypePort,
				Default: 8999,
				PortConfig: &models.PortConfig{
					AutoResolveConflict: true,
				},
			},
		},
		ComposeYAML: "port: {{ .PORT }}",
	}

	res, err := eng.Evaluate(tmpl, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	resolvedPort, ok := res.EvaluatedVariables["PORT"].(int)
	if !ok {
		t.Fatalf("expected int port, got: %T", res.EvaluatedVariables["PORT"])
	}

	if resolvedPort == 8999 {
		t.Errorf("port conflict was not resolved; still 8999")
	}

	if len(res.Warnings) == 0 {
		t.Errorf("expected conflict warning, got none")
	}

	fmt.Printf("Resolved conflicting port 8999 -> %d (Warning: %s)\n", resolvedPort, res.Warnings[0])
}
