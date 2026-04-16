FROM node:lts-alpine AS base
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install
COPY . .

FROM base AS dev
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]

FROM base AS build
RUN npm run build

FROM node:lts-alpine AS production
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install --production --silent
COPY --from=build /usr/src/app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
