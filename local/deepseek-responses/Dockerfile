FROM golang:1.26-alpine AS build
WORKDIR /src
COPY main.go .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /deepseek-responses main.go

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /deepseek-responses /deepseek-responses
USER 65532:65532
ENTRYPOINT ["/deepseek-responses"]
