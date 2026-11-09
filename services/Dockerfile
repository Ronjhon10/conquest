# One image per service: docker build -f services/Dockerfile --build-arg SERVICE=search-api .
FROM node:22-alpine
ARG SERVICE
ARG APP_VERSION=dev
WORKDIR /repo
COPY . .
RUN npm ci --omit=dev --no-audit --no-fund -w services/${SERVICE} && npm cache clean --force
WORKDIR /repo/services/${SERVICE}
ENV NODE_ENV=production PORT=8080 APP_VERSION=${APP_VERSION}
USER 1000
EXPOSE 8080
CMD ["/repo/node_modules/.bin/tsx", "src/index.ts"]
