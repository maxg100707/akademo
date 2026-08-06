# AKADEMO

SaaS front-end modular para organizar a jornada de um estudante. A interface abre em login, cria a conta por e-mail/senha ou Google, configura o primeiro perfil de estudo e mantém o perfil e a preferência de tema no navegador.

## Estrutura

```text
assets/                    imagem padrão de perfil
src/config.js              credenciais públicas do projeto
src/services/              Auth, dados, Storage e Supabase
src/ui/                    telas e componentes de interface
src/utils/                 ícones e funções auxiliares
styles/                    CSS separado por responsabilidade
supabase/schema.sql        tabelas, triggers e RLS completos (instalação nova)
supabase/teachers-migration.sql    migração de professores (instalações existentes)
supabase/disciplines-migration.sql migração de disciplinas (após professores)
supabase/schedules-migration.sql   migração de horários (após disciplinas)
supabase/profile-dates-migration.sql período de início e fim dos perfis
supabase/chronogram-migration.sql  migração do cronograma (após horários e datas)
supabase/lessons-migration.sql     migração de aulas e conteúdos (após cronograma)
supabase/functions/        Edge Function segura para buckets e avatar Google
```

## Conectar ao Supabase

1. Crie um projeto no Supabase e execute integralmente [supabase/schema.sql](supabase/schema.sql) no **SQL Editor**.
2. Em **Authentication > Providers**, habilite Email e Google e informe o Client ID e Client Secret obtidos no Google Cloud.
3. Em `src/config.js`, preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` com os valores em **Settings > API**. A chave `anon` é apropriada para o navegador; jamais use `service_role` aqui.
4. Instale a CLI do Supabase, faça login e publique a função:

   ```bash
   supabase functions deploy provision-user-storage --no-verify-jwt
   ```

   A função valida o Bearer token internamente antes de qualquer operação; `--no-verify-jwt` permite apenas que a requisição `OPTIONS` do CORS chegue a ela. A `SUPABASE_SERVICE_ROLE_KEY` já é disponibilizada como secret padrão no ambiente de produção das Edge Functions. Se estiver usando desenvolvimento local, defina-a somente no arquivo de secrets local da CLI.
5. Sirva a pasta por HTTP, por exemplo com a extensão Live Server do VS Code. Não abra o `index.html` diretamente pelo explorador, pois o login OAuth precisa de uma origem HTTP válida.

### Atualização para instalações existentes

Se o projeto já está em uso, execute as migrações que ainda não foram aplicadas nesta ordem: `supabase/teachers-migration.sql`, `supabase/disciplines-migration.sql`, `supabase/schedules-migration.sql`, `supabase/profile-dates-migration.sql`, `supabase/chronogram-migration.sql` e `supabase/lessons-migration.sql`. Depois publique novamente a Edge Function `provision-user-storage`, pois ela passa a aceitar materiais de aula de até 20 MB.

### Google OAuth: URLs que não podem ser confundidas

- No **Google Cloud > OAuth client (Web)**, o único *Authorized redirect URI* do Supabase deve ser `https://SEU-PROJECT-REF.supabase.co/auth/v1/callback`. Copie a Callback URL apresentada no provedor Google do painel Supabase.
- Em **Supabase > Authentication > URL Configuration**, use a URL onde o AKADEMO está aberto, por exemplo `http://localhost:5500`, como *Site URL* e em *Redirect URLs*.
- No Supabase, use o **Client ID** e o **Client Secret** do mesmo cliente OAuth do Google. Não use o nome do projeto nem a chave API do Google.

## Segurança aplicada

- Tokens e a sessão são gerenciados pelo Supabase Auth; o app **não salva senha** em `localStorage`.
- `localStorage` guarda somente a identidade da sessão, tema e perfil atual, para melhorar a retomada da interface.
- RLS bloqueia leitura, alteração e remoção entre usuários em `users`, `perfil_estudo` e Storage.
- Cada bucket de avatar é privado e tem o e-mail autenticado como identificador, conforme a proposta. A criação é feita por Edge Function usando o e-mail do JWT validado, não por dados enviados pelo navegador.
- A chave `service_role` fica exclusivamente na Edge Function.
