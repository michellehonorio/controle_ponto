# Especificação Funcional — App de Controle de Ponto (PWA)

Versão 1.3 — 09/09/2026 (corrige a fórmula do intervalo obrigatório: veja item 2 e 4.3)

## 0. Status atual do projeto

- ✅ **Implementado e testado**: todas as regras de negócio (itens 1 a 8 abaixo), as 4 telas (Hoje, Histórico, Registro manual, Configurações), armazenamento local (offline) e os alertas dinâmicos de notificação. Já rodei testes automatizados da lógica de cálculo e um teste completo simulando um dia de trabalho de ponta a ponta, sem erros encontrados.
- 🔧 **Corrigido na v1.3**: a fórmula do intervalo obrigatório estava errada (usava um "crédito fixo de 15min" que não reflete a regra real). A regra correta, validada com exemplos concretos: os primeiros 30 minutos do intervalo (o mínimo obrigatório) são fixos e não empurram o previsto; só o que exceder 30 minutos empurra, minuto a minuto. Ver itens 2 e 4.3.
- ⏳ **Pendente**: sincronização com o OneDrive (itens 19/20 da lista original — depende de você criar um cadastro gratuito de aplicativo no Azure); hospedar o app num link público pra instalar no celular (GitHub Pages, combinado); e ajustar o visual/layout conforme o design que você está criando (aguardando você conseguir me enviar o print ou export dele).

## 1. Visão geral

Aplicativo web progressivo (PWA), acessado pelo navegador do celular e instalável na tela inicial, para registrar os horários de entrada e saída do trabalho, calcular automaticamente o saldo de horas do dia (positivo ou negativo) e alertar a usuária nos momentos certos, evitando que ela esqueça de bater o ponto ou perca o controle da jornada.

Funciona offline (dados sempre salvos no celular primeiro) e sincroniza automaticamente com o OneDrive da usuária quando há conexão com a internet, permitindo acesso ao histórico em outros dispositivos e evitando perda de dados.

## 2. Conceitos e limites da jornada

| Parâmetro | Valor |
|---|---|
| Jornada líquida de trabalho (sem contar intervalo) | 5h45 (345 min) |
| Intervalo obrigatório mínimo | 30 minutos |
| Intervalo obrigatório máximo | 1 hora (60 min) |
| Meta de "tempo computado" para fechar a jornada em dia | 6h15 (375 min) = jornada líquida (5h45) + intervalo mínimo (30min) — ver fórmula no item 4 |
| Tolerância na saída final | 10 minutos |

## 3. Estrutura de registros do dia

Cada dia pode ter até 3 pares de entrada/saída:

1. **1ª entrada** e **1ª saída** — obrigatórias
2. **2ª entrada** e **2ª saída** — obrigatórias
3. **3ª entrada** e **3ª saída** — opcionais (só acontecem se a jornada não foi concluída no 2º período)

O intervalo obrigatório (30min–1h) é contado **entre a 1ª saída e a 2ª entrada** — é a pausa principal do dia. Os primeiros 30 minutos dele (o mínimo obrigatório) já estão embutidos na meta de 6h15 e não empurram o horário previsto; só o tempo que exceder os 30 minutos empurra.

Se houver um 3º período, o intervalo entre a **2ª saída e a 3ª entrada** é uma pausa **livre**: sem duração mínima ou máxima, e sem nenhum desconto embutido — ela simplesmente não conta nem a favor nem contra a usuária, apenas empurra o horário previsto de saída para mais tarde (minuto a minuto, na íntegra).

## 4. Lógica de cálculo

### 4.1 Ao registrar a 1ª entrada
- Sistema marca o início da jornada.
- Calcula uma previsão inicial do horário de saída = horário da 1ª entrada + 6h15 (meta total). Essa previsão é só uma estimativa inicial e será recalculada em seguida, na volta do intervalo (item 4.3), já com base no intervalo realmente feito.

### 4.2 Ao registrar a 1ª saída
- Sistema entende que a pausa obrigatória começou.
- Passa a exibir na tela a contagem regressiva até completar os 30 minutos mínimos do intervalo.
- Envia alerta quando faltarem 5 minutos para completar os 30 min, e outro exatamente aos 30 min.

### 4.3 Ao registrar a 2ª entrada (volta do intervalo)
- Calcula a duração real do intervalo (2ª entrada − 1ª saída).
- **Os primeiros 30 minutos do intervalo (o mínimo obrigatório) são sempre fixos**, não importa se o intervalo durou 30, 45 ou 60 minutos — esse valor não muda com um intervalo mais longo, nem é reduzido se o intervalo for menor que 30 (ver observação no item 6 pra esse caso abaixo do mínimo).
- Um intervalo mais longo que o mínimo não reduz as horas de trabalho exigidas, mas empurra o horário final do expediente mais para frente: cada minuto que exceder os 30 min mínimos é "tempo morto" — não conta como trabalho nem é remunerado, e adia a saída na mesma proporção (1 minuto de intervalo extra = 1 minuto de saída mais tarde).
- **Tempo computado** = tempo trabalhado (1º + 2º período) + 30 minutos fixos (o intervalo mínimo obrigatório).
- **Horário previsto de saída** = horário da 2ª entrada + (meta de 6h15 − tempo computado até aqui). Isso é equivalente a: horário da 1ª entrada + 5h45 (jornada líquida) + intervalo real (na íntegra, sem desconto). Recalcula e exibe esse novo horário previsto, e quanto falta para atingir a meta de 6h15 de tempo computado.

**Exemplo:** entrada 08:00, saída 12:00, volta às 12:30 (intervalo de 30min, exatamente o mínimo) → previsto = 14:15 (não muda da estimativa inicial). Volta às 12:40 (intervalo de 40min, 10min acima do mínimo) → previsto = 14:25 (empurrado exatamente os 10min excedentes).

### 4.4 Durante o 2º período de trabalho
- Envia alerta quando faltarem 10 minutos para atingir a meta (6h15 de tempo computado), e outro exatamente ao atingir a meta.
- O horário previsto de encerramento da jornada fica sempre visível na tela.

### 4.5 Ao registrar a 2ª saída
- O sistema apenas registra o horário e pausa a contagem de trabalho — **não decide sozinho se o dia terminou**. A usuária decide o que fazer em seguida:
  - Registrar uma **3ª entrada** (voltando a trabalhar depois de uma pausa livre); ou
  - Tocar no botão **"Encerrar jornada"**, disponível a qualquer momento depois de uma saída, para fechar o dia.

### 4.6 Se houver 3º período (após a 3ª entrada)
- O tempo da pausa entre a 2ª saída e a 3ª entrada é totalmente desconsiderado (nem soma, nem desconta — ver item 3).
- O trabalho do 3º período soma normalmente ao tempo computado.
- O horário previsto de saída é recalculado, empurrado pelo tempo da pausa livre.

### 4.7 Encerrando a jornada (botão "Encerrar jornada")
Ao encerrar, o sistema compara o **tempo computado final** com a meta de 6h15 e aplica uma tolerância de **10 minutos para os dois lados** (tanto para quem sai depois, quanto para quem sai antes do previsto):

- **Diferença de até 10 minutos, pra mais ou pra menos** (ex: sair com 6h05 ou com 6h20) → contabilizado como jornada normal, **sem nenhum impacto no saldo**.
- **11 minutos ou mais depois da meta** → todo o tempo excedente (a partir do 1º minuto) é lançado como **saldo positivo** no banco de horas.
- **11 minutos ou mais antes da meta** (ex: usuária opta por não fazer um 3º período e sai bem antes de completar 6h15) → sistema oferece a opção de encerrar mesmo assim, e lança a diferença como **saldo negativo** no banco de horas daquele dia.

### 4.8 Se o intervalo (1ª saída → 2ª entrada) passar de 1 hora
- Não há penalidade adicional no banco de horas: o tempo computado sempre usa os mesmos 30 minutos fixos do intervalo mínimo, independente de quão longo o intervalo real tenha sido. O único efeito de um intervalo maior que 1 hora é continuar empurrando o horário previsto de saída, minuto a minuto, exatamente como qualquer minuto acima do mínimo de 30 (ver 4.3) — sem desconto extra no banco de horas além disso.

## 5. Registro dos horários

- **Botão "Agora"**: forma principal de uso — um toque registra o horário atual na hora, para o próximo ponto esperado do dia.
- **Registro/edição manual**: caso a usuária esqueça de bater o ponto no momento certo, ela pode informar o horário manualmente depois (em vez de usar "Agora").
- É possível editar ou excluir qualquer registro já lançado, inclusive de dias anteriores. Ao editar um registro de um dia passado, o sistema recalcula automaticamente o saldo daquele dia e atualiza o saldo acumulado total.

## 6. Observação sobre intervalo abaixo do mínimo

As regras definem um intervalo mínimo de 30 minutos, mas não impedem que a usuária registre a volta antes disso (ela pode ter motivos reais para isso). Nesse caso, o sistema não bloqueia o registro, apenas avisa que o mínimo não foi atingido. Para fins de cálculo, os 30 minutos fixos continuam sendo usados no tempo computado (item 4.3) — mas como o horário previsto é calculado a partir do intervalo real (não do fixo), um intervalo menor que o mínimo faz o previsto ficar mais próximo do horário de entrada (ou até antes do que seria com um intervalo de 30min completos). Avise se preferir um comportamento diferente (por exemplo, bloquear o registro nesse caso, ou tratar esse cenário de outra forma).

## 7. Armazenamento e sincronização

- **Local (offline-first)**: todos os registros ficam salvos direto no celular (banco de dados local do navegador), então o app funciona normalmente mesmo sem internet.
- **Nuvem (OneDrive)**: sempre que houver conexão, os dados são sincronizados automaticamente com um arquivo dentro da conta OneDrive da usuária (login único via conta Microsoft). Isso garante backup do histórico e acesso pelos outros dispositivos em que ela fizer login.
- Como o uso é de uma única pessoa, a sincronização é simples: o registro mais recentemente alterado prevalece em caso de conflito entre o que está no celular e o que está no OneDrive.

## 8. Notificações

- Alertas dinâmicos, calculados a partir dos horários realmente registrados (fim do intervalo — 5 min antes e aos 30 min; fim da jornada — 10 min antes e ao atingir 6h15).
- Sem lembrete fixo para bater o primeiro ponto do dia (por decisão da usuária) — os alertas só existem depois que a jornada já começou.
- Limitação aceita: como é um PWA, notificações com o app totalmente fechado por muito tempo podem, ocasionalmente, ser atrasadas pelo próprio Android (gerenciamento de bateria). O app será construído da forma mais robusta possível dentro do que a tecnologia permite.

## 9. Telas principais

1. **Hoje**: status atual da jornada (trabalhando / em intervalo / encerrada), próximo horário relevante, botão grande para registrar o próximo ponto esperado, e botão "Encerrar jornada".
2. **Histórico**: lista de dias com todos os horários registrados, saldo do dia e saldo acumulado; permite editar ou excluir qualquer registro.
3. **Registro manual**: tela para lançar ou corrigir um horário informado manualmente.
4. **Configurações**: conexão com a conta Microsoft/OneDrive, status da sincronização e backup.

## 10. Dados armazenados por registro

- Data
- Tipo (entrada/saída) e sequência (1ª, 2ª ou 3ª)
- Horário
- Origem (automático ao tocar no botão, ou manual)
- Se foi editado posteriormente

E por dia: horários completos, tempo trabalhado, tempo computado, saldo do dia (+/-) e status (aberto/encerrado). Mais um saldo acumulado total, atualizado a cada dia encerrado.

## 11. Tecnologia usada

- **Angular** (versão mais recente, 22) com TypeScript — tudo roda direto no navegador do celular, sem precisar de um servidor separado.
- **PWA**: instalável na tela inicial, com ícone e funcionamento offline via Service Worker.
- **IndexedDB**: banco de dados local do navegador, onde os registros ficam salvos no próprio celular.
- Visual ainda no padrão simples/neutro do Angular — ajuste de layout e cores está pendente conforme o item 0 acima.

## 12. Fora do escopo desta primeira versão

- Relatórios/exportação em PDF ou Excel do histórico (pode ser incluído depois, se desejar).
- Múltiplos usuários ou perfis de jornada diferentes.
- Publicação do app na Google Play Store (não é necessário para uso pessoal).
