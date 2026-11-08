FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY public ./public
ENV PORT=3040
EXPOSE 3040
CMD ["node", "server.js"]
