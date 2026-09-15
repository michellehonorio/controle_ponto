# Configurar a sincronização com o Firebase

O app usa login com sua conta Google e o Firestore (banco de dados do Firebase) pra guardar
seus registros na nuvem, isolados por conta (cada pessoa só vê os próprios dados).

## Passo a passo

1. Acesse [console.firebase.google.com](https://console.firebase.google.com), faça login com sua conta Google e clique em **"Adicionar projeto"**. Siga o assistente (pode desativar o Google Analytics, não é necessário).

2. Dentro do projeto criado, no menu lateral: clique em **"Segurança"** pra expandir → **Authentication** → **"Vamos começar"** → na aba **"Método de login"**, clique em **Google** na lista de provedores → ative → salve.
   (o console do Firebase muda de layout de vez em quando — se não achar "Segurança", use a busca no topo e digite "Authentication".)

3. No menu lateral: clique em **"Bancos de dados e ar..."** (Bancos de dados e armazenamento) → **Cloud Firestore** → **"Create database"** → na etapa "Selecionar a edição", deixe **Standard** (padrão, gratuita) → **Avançar** → escolha uma localização (`southamerica-east1` se aparecer, ou a sugerida) → **Avançar** → deixe **"Iniciar no modo de produção"** selecionado → **Criar**.

4. Ainda em **Firestore Database**, vá na aba **Rules** e substitua o conteúdo por:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /usuarios/{uid}/{documento=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

   Clique em **Publish**. Isso garante que cada conta só acessa os próprios dados.

5. Clique em **"Configurações"** (ícone de engrenagem, no topo do menu lateral) → aba **Geral** → role até **Seus apps** → clique no ícone **</>** (Web) → dê um nome (ex: "Controle de Ponto") → **Registrar app** (não precisa marcar Firebase Hosting) → **Continuar no console** (não precisa copiar/colar o código de exemplo mostrado ali).

6. Copie o objeto `firebaseConfig` que aparece — algo como:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "seu-projeto.firebaseapp.com",
     projectId: "seu-projeto",
     storageBucket: "seu-projeto.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

7. Ainda em Authentication, vá na aba **Configurações** → **Domínios autorizados** → confirme que `localhost` já está na lista e clique em **Adicionar domínio** pra incluir `michellehonorio.github.io`.

## Onde colocar a configuração

Abra [`src/app/core/constants.ts`](../src/app/core/constants.ts) e preencha os valores copiados no passo 6 dentro de `FIREBASE_CONFIG`.

Depois disso, o botão "Conectar com Google" na tela de Configurações passa a funcionar.

## Como conferir se está sincronizando

Depois de conectar e registrar algum ponto, acesse o [console do Firebase](https://console.firebase.google.com) → seu projeto → **Firestore Database** → **Data** → deve aparecer a coleção `usuarios/<seu-id>/registros` com os documentos.
