# Pôr o Ironbound online em ironbound.pt

Backend → Google Cloud Run (grátis dentro da quota). Frontend → Firebase Hosting
(mesma conta Google, grátis, SSL automático). Base de dados e storage já estão
no Supabase (feito numa sessão anterior).

## 0. O que precisas de ter

- Conta Google (para Cloud Run e Firebase — pode ser a mesma).
- Acesso à gestão de DNS do domínio `ironbound.pt` (onde o registaste).
- [Node.js](https://nodejs.org) instalado localmente (já tens, é o que corre o projeto).
- `gcloud` CLI: https://cloud.google.com/sdk/docs/install
- Firebase CLI: `npm install -g firebase-tools`

## 1. Backend → Google Cloud Run

Na pasta `backend/`:

```bash
gcloud auth login
gcloud projects create ironbound-app --name="Ironbound"
gcloud config set project ironbound-app
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

Faz o deploy (o `Dockerfile` já está pronto):

```bash
cd backend
gcloud run deploy ironbound-api \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 8080
```

Isto demora uns minutos (constrói a imagem e publica). No fim dá-te um URL tipo
`https://ironbound-api-xxxxx.run.app` — guarda-o, vais precisar dele no passo 2.

### Variáveis de ambiente em produção

Depois do primeiro deploy, mete as variáveis a sério (Cloud Console →
Cloud Run → `ironbound-api` → Edit & Deploy New Revision → Variables, ou por
linha de comandos):

```bash
gcloud run services update ironbound-api --region europe-west1 \
  --set-env-vars DATABASE_URL="a_tua_connection_string_do_supabase" \
  --set-env-vars JWT_SECRET="um_segredo_novo_longo_e_aleatorio_so_de_producao" \
  --set-env-vars FRONTEND_URL="https://ironbound.pt" \
  --set-env-vars ALLOWED_ORIGINS="https://ironbound.pt,https://www.ironbound.pt" \
  --set-env-vars SUPABASE_URL="https://[PROJECT-REF].supabase.co" \
  --set-env-vars SUPABASE_SERVICE_ROLE_KEY="a_tua_service_role_key" \
  --set-env-vars SUPABASE_STORAGE_BUCKET="uploads" \
  --set-env-vars GOOGLE_CLIENT_ID="o_teu_client_id.apps.googleusercontent.com"
```

**Importante — storage**: em produção, o Cloud Run **tem mesmo de** ter o
Supabase Storage configurado (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/
`SUPABASE_STORAGE_BUCKET`). Sem isso, os avatares e fotos ficariam no disco do
contentor, que é apagado sempre que o Cloud Run reinicia ou escala — os
uploads desapareciam. Ver `backend/.env.example` para como criar o bucket.

(SMTP para emails a sério é opcional — sem isso, o link de confirmação
continua só a aparecer no log do Cloud Run, como em dev.)

### Domínio `api.ironbound.pt`

```bash
gcloud beta run domain-mappings create \
  --service ironbound-api --domain api.ironbound.pt --region europe-west1
```

Isto dá-te um ou mais registos DNS (normalmente CNAME) para adicionares no
teu fornecedor de domínio — ver passo 3.

## 2. Frontend → Firebase Hosting

Na pasta `frontend/`, cria um `.env.production` (não committed) com os
valores de produção:

```
VITE_API_URL=https://api.ironbound.pt/api
VITE_GOOGLE_CLIENT_ID=o_teu_client_id.apps.googleusercontent.com
```

Depois:

```bash
cd frontend
npm run build
firebase login
firebase init hosting
# Use an existing project → cria um novo projeto Firebase (ex: ironbound-app)
# Public directory: dist
# Single-page app: Yes
# (Não sobrescrevas o firebase.json que já existe no projeto)
firebase deploy --only hosting
```

O `firebase.json` já está pronto (`public: "dist"`, com o rewrite para SPA
e cache longo nos ficheiros com hash no nome).

### Domínio `ironbound.pt`

Firebase Console → o teu projeto → Hosting → **Add custom domain** →
`ironbound.pt` (repete para `www.ironbound.pt` se quiseres os dois). Dá-te os
registos DNS (normalmente A records + um TXT de verificação) — passo 3.

## 3. DNS em ironbound.pt

No painel do teu fornecedor de domínio, adiciona os registos que o Cloud Run
(passo 1) e o Firebase (passo 2) te derem. Em resumo, vai ficar mais ou menos
assim (os valores exatos vêm dos passos acima, não inventes):

| Tipo  | Nome  | Aponta para                             |
|-------|-------|------------------------------------------|
| A/TXT | @     | (dado pelo Firebase, para ironbound.pt) |
| A/TXT | www   | (dado pelo Firebase, opcional)          |
| CNAME | api   | `ghs.googlehosted.com.`                 |

O SSL (cadeado) é emitido automaticamente pelos dois serviços depois do DNS
propagar — pode demorar de minutos a algumas horas.

## 4. Autorizar o domínio novo no Google Login

Vai a [console.cloud.google.com](https://console.cloud.google.com) → o
projeto onde criaste o Client ID → APIs & Services → Credentials → o teu
OAuth Client → em **Authorized JavaScript origins**, adiciona
`https://ironbound.pt` (o `localhost:5173` pode ficar, continua a servir para
testares em dev).

## Limitações conhecidas desta configuração

- **classChecker** (cancela aulas de grupo sem mínimo de inscritos) corre
  com `setInterval` — só funciona enquanto o contentor do Cloud Run estiver
  vivo. Como o Cloud Run pode escalar a zero sem pedidos, este verificador
  pode não correr com regularidade em produção. Não é um problema para
  mostrar o projeto, mas não é fiável para um ginásio a sério sem mudar
  para um agendador externo (ex: Cloud Scheduler a chamar um endpoint).
- **Cold start**: depois de uns minutos sem pedidos, o primeiro pedido
  seguinte demora 1-5 segundos a "acordar" o Cloud Run — é a troca pela
  quota gratuita.
