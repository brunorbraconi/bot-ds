# Discord Music Bot

Bot de música para Discord con reproducción desde YouTube, soporte de playlists y comandos por slash.

## Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- [npm](https://www.npmjs.com/) (incluido con Node.js)
- Un servidor de Discord donde tengas permisos para invitar bots

## Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd bot-ds
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar el archivo `.env`

Copia el archivo de ejemplo y edítalo con tus datos:

```bash
cp .env.example .env
```

Abre `.env` en un editor y completa los valores:

```
DISCORD_TOKEN=tu_token_del_bot_aqui
CLIENT_ID=tu_application_id_aqui
GUILD_ID=id_de_tu_servidor_aqui
```

### 4. Crear la aplicación en Discord Developer Portal

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Haz clic en **"New Application"**, ponle un nombre y créala
3. Ve a la sección **"Bot"** en el menú de la izquierda
4. Haz clic en **"Reset Token"** y luego **"Copy"** — ese es tu `DISCORD_TOKEN`
5. En la misma sección **Bot**, activa los siguientes **Privileged Gateway Intents**:
   - ✅ **Server Members Intent** (opcional pero recomendado)
   - ✅ **Message Content Intent** (opcional pero recomendado)
6. Ve a la sección **"OAuth2" > "General"** y copia el **"Client ID"** (APPLICATION ID) — ese es tu `CLIENT_ID`
7. Para conseguir el `GUILD_ID`, activa el **Modo Desarrollador** en Discord (`Ajustes > Avanzado > Modo Desarrollador`), haz clic derecho en tu servidor y selecciona **"Copiar ID"**

### 5. Invitar el bot a tu servidor

1. En el Developer Portal, ve a **"OAuth2" > "URL Generator"**
2. Marca **"bot"** en Scopes
3. Marca estos permisos en **Bot Permissions**:
   - ✅ **Send Messages**
   - ✅ **Connect**
   - ✅ **Speak**
   - ✅ **Use Slash Commands**
4. Copia la URL generada, pégala en tu navegador y selecciona el servidor donde quieres invitar el bot

### 6. Registrar los comandos (Slash Commands)

Para registrar los comandos de forma instantánea en tu servidor (requiere `GUILD_ID` en `.env`):

```bash
npm run register
```

Esto cargará todos los comandos de la carpeta `src/commands/` y los registrará en Discord.

> Si no configuras `GUILD_ID`, los comandos se registrarán de forma **global** y pueden tardar hasta 1 hora en aparecer.

### 7. Iniciar el bot

```bash
npm start        # Modo producción
npm run dev      # Modo desarrollo (con recarga automática al editar)
```

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `/play <canción>` | Reproduce una canción desde YouTube |
| `/skip` | Salta a la siguiente canción |
| `/stop` | Detiene la reproducción y limpia la cola |
| `/queue` | Muestra la cola de reproducción |
| `/volume <0-100>` | Ajusta el volumen |
| `/shuffle` | Mezcla aleatoriamente la cola |
| `/loop` | Alterna el modo de repetición |
| `/search <término>` | Busca canciones en YouTube y selecciona una |
| `/playlist` | Gestiona tus playlists guardadas |

## Estructura del proyecto

```
bot-ds/
├── src/
│   ├── commands/      # Comandos del bot
│   ├── music/         # Lógica de reproducción
│   ├── utils/         # Utilidades (logger, db, etc.)
│   ├── client.ts      # Configuración del cliente de Discord
│   ├── deploy-commands.ts  # Script para registrar comandos
│   └── index.ts       # Punto de entrada
├── .env.example       # Plantilla de configuración
├── package.json
├── tsconfig.json
└── README.md
```
