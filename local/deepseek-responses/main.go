package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

type responseStream struct {
	io.Closer
	input   *bufio.Reader
	pending []byte
	end     error
}

func (s *responseStream) Read(p []byte) (int, error) {
	for len(s.pending) == 0 && s.end == nil {
		var frame []byte
		for {
			line, err := s.input.ReadBytes('\n')
			frame = append(frame, line...)
			s.end = err
			if err != nil || bytes.Equal(line, []byte("\n")) || bytes.Equal(line, []byte("\r\n")) {
				break
			}
		}
		if !reasoningPart(frame) {
			s.pending = frame
		}
	}
	if len(s.pending) == 0 {
		return 0, s.end
	}
	n := copy(p, s.pending)
	s.pending = s.pending[n:]
	return n, nil
}

func reasoningPart(frame []byte) bool {
	for _, line := range bytes.Split(frame, []byte("\n")) {
		data, ok := bytes.CutPrefix(line, []byte("data:"))
		if !ok {
			continue
		}
		var event struct {
			Type string `json:"type"`
			Part struct {
				Type string `json:"type"`
			} `json:"part"`
		}
		// DeepSeek emits reasoning text as content parts, which Foundry's Responses decoder rejects.
		return json.Unmarshal(data, &event) == nil && event.Part.Type == "reasoning_text" &&
			(event.Type == "response.content_part.added" || event.Type == "response.content_part.done")
	}
	return false
}

func main() {
	proxy := &httputil.ReverseProxy{
		Rewrite: func(r *httputil.ProxyRequest) {
			r.SetURL(&url.URL{Scheme: "https", Host: "api.deepseek.com"})
			r.Out.Header = http.Header{
				"Authorization": {r.In.Header.Get("Authorization")},
				"Content-Type":  {r.In.Header.Get("Content-Type")},
				"Accept":        {r.In.Header.Get("Accept")},
			}
		},
		ModifyResponse: func(r *http.Response) error {
			contentType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
			if r.StatusCode == http.StatusOK && contentType == "text/event-stream" {
				r.Body = &responseStream{Closer: r.Body, input: bufio.NewReader(r.Body)}
				r.ContentLength = -1
				r.Header.Del("Content-Length")
			}
			return nil
		},
	}
	mux := http.NewServeMux()
	mux.Handle("POST /responses", proxy)
	srv := &http.Server{Addr: "127.0.0.1:18793", Handler: mux, ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
