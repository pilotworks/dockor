package agent

import (
	"bytes"
	"testing"
)

func TestFrameEncodeDecode(t *testing.T) {
	payload := []byte(`{"jsonrpc":"2.0","method":"ping","id":"123"}`)
	original := Frame{
		Version:    ProtocolVersion,
		StreamType: StreamTypeControl,
		Flags:      FlagSYN,
		StreamID:   42,
		Payload:    payload,
	}

	encoded := EncodeFrame(original)
	if len(encoded) != HeaderSize+len(payload) {
		t.Fatalf("expected length %d, got %d", HeaderSize+len(payload), len(encoded))
	}

	decoded, err := DecodeFrame(encoded)
	if err != nil {
		t.Fatalf("failed to decode frame: %v", err)
	}

	if decoded.Version != original.Version {
		t.Errorf("expected version %d, got %d", original.Version, decoded.Version)
	}
	if decoded.StreamType != original.StreamType {
		t.Errorf("expected stream type %d, got %d", original.StreamType, decoded.StreamType)
	}
	if decoded.Flags != original.Flags {
		t.Errorf("expected flags %d, got %d", original.Flags, decoded.Flags)
	}
	if decoded.StreamID != original.StreamID {
		t.Errorf("expected stream ID %d, got %d", original.StreamID, decoded.StreamID)
	}
	if !bytes.Equal(decoded.Payload, original.Payload) {
		t.Errorf("expected payload %s, got %s", string(original.Payload), string(decoded.Payload))
	}
}

func TestDecodeFrameTooShort(t *testing.T) {
	_, err := DecodeFrame([]byte{1, 2, 3})
	if err == nil {
		t.Fatal("expected error when decoding data shorter than header size")
	}
}
