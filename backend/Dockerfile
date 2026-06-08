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
COPY --from=build /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /usr/src/app/prisma ./prisma
EXPOSE 4000
RUN chown -R node /usr/src/app
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]
