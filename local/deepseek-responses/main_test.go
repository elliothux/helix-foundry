package main

import (
	"bufio"
	"io"
	"strings"
	"testing"
)

func TestResponseStreamPreservesReasoningAndToolCalls(t *testing.T) {
	removed := "event: response.content_part.added\r\ndata: {\"type\":\"response.content_part.added\",\"part\":{\"type\":\"reasoning_text\"}}\r\n\r\n"
	removedDone := "data: {\"type\":\"response.content_part.done\",\"part\":{\"type\":\"reasoning_text\"}}\n\n"
	reasoning := "data: {\"type\":\"response.reasoning_text.delta\",\"delta\":\"reason\"}\n\n"
	text := "data: {\"type\":\"response.content_part.added\",\"part\":{\"type\":\"output_text\"}}\n\n"
	tool := "data: {\"type\":\"response.function_call_arguments.done\"}\n\n"
	terminal := "data: {\"type\":\"response.completed\"}"
	source := strings.NewReader(removed + reasoning + removedDone + text + tool + terminal)
	stream := &responseStream{Closer: io.NopCloser(source), input: bufio.NewReader(source)}
	got, err := io.ReadAll(stream)
	if err != nil || string(got) != reasoning+text+tool+terminal {
		t.Fatalf("normalized stream = %q, %v", got, err)
	}
}
