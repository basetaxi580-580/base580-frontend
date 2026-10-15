FROM node:24.15.0-bookworm AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=build /app/dist/base580-frontend/browser /usr/share/nginx/html
EXPOSE 80
