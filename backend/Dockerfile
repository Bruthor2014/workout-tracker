# Imagem de produção do backend (Cloud Run injeta PORT automaticamente —
# ver server.js, já lê process.env.PORT). Build única: bcrypt é um módulo
# nativo, por isso instalam-se as ferramentas de compilação antes do
# npm ci e tiram-se a seguir, para a imagem final ficar mais pequena.
# Node 22+ (não 20): o cliente Realtime do @supabase/supabase-js precisa de
# WebSocket nativo, que só entrou no Node a partir da v22 — com Node 20 o
# container rebentava logo no arranque (services/storage.js importa o
# cliente Supabase).
FROM node:22-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "server.js"]
