# Configurar a sincronização com o Firebase

O app usa login com sua conta Google e o Firestore (banco de dados do Firebase) pra guardar
seus registros na nuvem, isolados por conta (cada pessoa só vê os próprios dados).

## Passo a passo

1. Acesse [console.firebase.google.com](https://console.firebase.google.com), faça login com sua conta Google e clique em **"Adicionar projeto"**. Siga o assistente (pode desativar o Google Analytics, não é necessário).

2. Dentro do projeto criado: menu **Build** → **Authentication** → **Get started** → aba **Sign-in method** → clique em **Google** → ative → salve.

3. Menu **Build** → **Firestore Database** → **Create database** → escolha o modo **produção** → escolha uma localização (`southamerica-east1` se aparecer, ou a sugerida) → **Enable**.

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

5. Clique no ícone de engrenagem (⚙️) ao lado de "Project Overview" → **Configurações do projeto** → aba **Geral** → role até **Seus apps** → clique no ícone **</>** (Web) → dê um nome (ex: "Controle de Ponto") → **Registrar app** (não precisa marcar Firebase Hosting).

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

7. Ainda em Authentication, vá na aba **Settings** → **Authorized domains** → confirme que `localhost` já está na lista e clique em **Add domain** pra adicionar `michellehonorio.github.io`.

## Onde colocar a configuração

Abra [`src/app/core/constants.ts`](../src/app/core/constants.ts) e preencha os valores copiados no passo 6 dentro de `FIREBASE_CONFIG`.

Depois disso, o botão "Conectar com Google" na tela de Configurações passa a funcionar.

## Como conferir se está sincronizando

Depois de conectar e registrar algum ponto, acesse o [console do Firebase](https://console.firebase.google.com) → seu projeto → **Firestore Database** → **Data** → deve aparecer a coleção `usuarios/<seu-id>/registros` com os documentos.
