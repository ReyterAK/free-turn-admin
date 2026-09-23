FROM alpine:3.24.2

RUN apk add --no-cache ca-certificates

COPY bin/free-turn-admin /app/free-turn-admin
COPY core/ /app/core/

EXPOSE 8080

# Unauthenticated /healthz probe (busybox wget, no curl/python)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:${PORT:-8080}/healthz || exit 1

CMD ["/app/free-turn-admin"]
