# Mock CRACN API built from openapi.json. Build from the repository root:
#   docker build -f mocks/cracn/Dockerfile -t cracn-mock:local .
FROM node:22-alpine
WORKDIR /app
COPY openapi.json ./
COPY mocks/cracn/*.mjs mocks/cracn/data.json mocks/cracn/
USER node
EXPOSE 4010
ENTRYPOINT ["node", "mocks/cracn/server.mjs"]
CMD ["--host", "0.0.0.0", "--port", "4010"]
