package api

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/Jack-Of-Aces/dev-ledgr/backend/internal/store"
)

// apiError matches ApiErrorPayload in frontend/src/types/api.ts, which the
// frontend httpClient reads to build its ApiError.
type apiError struct {
	Message    string              `json:"message"`
	StatusCode int                 `json:"statusCode"`
	Code       string              `json:"code,omitempty"`
	Errors     map[string][]string `json:"errors,omitempty"`
}

func (e *apiError) Error() string { return e.Message }

func errBadRequest(msg string) *apiError {
	return &apiError{Message: msg, StatusCode: http.StatusBadRequest, Code: "BAD_REQUEST"}
}
func errUnauthorized(msg string) *apiError {
	return &apiError{Message: msg, StatusCode: http.StatusUnauthorized, Code: "UNAUTHORIZED"}
}
func errForbidden(msg string) *apiError {
	return &apiError{Message: msg, StatusCode: http.StatusForbidden, Code: "FORBIDDEN"}
}
func errNotFound(msg string) *apiError {
	return &apiError{Message: msg, StatusCode: http.StatusNotFound, Code: "NOT_FOUND"}
}
func errConflict(msg string) *apiError {
	return &apiError{Message: msg, StatusCode: http.StatusConflict, Code: "CONFLICT"}
}
func errTooMany(msg string) *apiError {
	return &apiError{Message: msg, StatusCode: http.StatusTooManyRequests, Code: "RATE_LIMITED"}
}

// validationErrors accumulates per-field messages, like zod's flatten().fieldErrors.
type validationErrors map[string][]string

func (v validationErrors) add(field, msg string) { v[field] = append(v[field], msg) }

func (v validationErrors) err() error {
	if len(v) == 0 {
		return nil
	}
	return &apiError{Message: "Validation failed", StatusCode: http.StatusUnprocessableEntity,
		Code: "VALIDATION_ERROR", Errors: v}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("encode response", "err", err)
	}
}

// writeError renders err, mapping store sentinels and hiding internals behind a 500.
func writeError(w http.ResponseWriter, r *http.Request, err error) {
	var ae *apiError
	switch {
	case errors.As(err, &ae):
	case errors.Is(err, store.ErrNotFound):
		ae = errNotFound("Resource not found")
	case errors.Is(err, store.ErrConflict):
		ae = errConflict("Resource already exists")
	default:
		slog.Error("internal error", "method", r.Method, "path", r.URL.Path, "err", err)
		ae = &apiError{Message: "Internal server error", StatusCode: http.StatusInternalServerError, Code: "INTERNAL"}
	}
	writeJSON(w, ae.StatusCode, ae)
}

// handler adapts error-returning handlers to http.HandlerFunc.
type handler func(w http.ResponseWriter, r *http.Request) error

func (h handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if err := h(w, r); err != nil {
		writeError(w, r, err)
	}
}

const maxBodyBytes = 1 << 20

// decodeJSON strictly decodes a required JSON body into dst.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	return decode(w, r, dst, false)
}

// decodeOptionalJSON is decodeJSON for endpoints where the body may be empty.
func decodeOptionalJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	return decode(w, r, dst, true)
}

func decode(w http.ResponseWriter, r *http.Request, dst any, optional bool) error {
	if ct := r.Header.Get("Content-Type"); ct != "" && !strings.HasPrefix(ct, "application/json") {
		return &apiError{Message: "Content-Type must be application/json", StatusCode: http.StatusUnsupportedMediaType, Code: "UNSUPPORTED_MEDIA_TYPE"}
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBodyBytes))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		if errors.Is(err, io.EOF) {
			if optional {
				return nil
			}
			return errBadRequest("Request body is required")
		}
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return &apiError{Message: "Request body too large", StatusCode: http.StatusRequestEntityTooLarge, Code: "PAYLOAD_TOO_LARGE"}
		}
		return errBadRequest("Invalid JSON body: " + err.Error())
	}
	if dec.More() {
		return errBadRequest("Request body must contain a single JSON object")
	}
	return nil
}
