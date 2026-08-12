FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/owasp-content/package.json packages/owasp-content/package.json
RUN npm install
COPY packages/owasp-content packages/owasp-content
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npm run db:generate
CMD ["sh", "-c", "npm run db:migrate:deploy && npm run db:seed && npm run start"]
