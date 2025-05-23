const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Configurações do bot - PERSONALIZAR PARA CADA CLIENTE
const CONFIG = {
    // SUBSTITUIR: Link do cardápio do cliente
    MENU_URL: 'https://sigmenu.com/delivery/restaurante',
    
    // SUBSTITUIR: Nome do restaurante
    RESTAURANT_NAME: 'Nome do Restaurante',
    
    // SUBSTITUIR: Horário de funcionamento
    OPENING_HOURS: 'Segunda a Domingo: 11h às 23h',
    
    // SUBSTITUIR: Emoji do tipo de comida
    FOOD_EMOJI: '🍽️',
    
    // Mensagem de boas-vindas (será montada automaticamente)
    WELCOME_MESSAGE: `Olá! {{FOOD_EMOJI}} Bem-vindo(a) ao *{{RESTAURANT_NAME}}*! 

Ficamos muito felizes em receber sua mensagem! 😊

Aqui está nosso cardápio digital completo com todos os pratos deliciosos que preparamos para você:

🍽️ *Cardápio Digital:* {{MENU_URL}}

📱 *Horário de Funcionamento:*
{{OPENING_HOURS}}

🚚 *Delivery disponível!*

Para fazer seu pedido, acesse nosso cardápio pelo link acima. Qualquer dúvida, nossa equipe está aqui para ajudar!

Obrigado por escolher o *{{RESTAURANT_NAME}}*! ❤️`
};

class RestaurantBot {
    constructor() {
        // Inicializa o cliente WhatsApp
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            }
        });

        this.setupEventListeners();
        this.processedMessages = new Set(); // Para evitar mensagens duplicadas
        this.clientCooldowns = new Map(); // Para controlar cooldown de 12h por cliente
    }

    setupEventListeners() {
        // Evento quando o QR Code é gerado
        this.client.on('qr', (qr) => {
            console.log('📱 Escaneie o QR Code abaixo com seu WhatsApp:');
            console.log('');
            qrcode.generate(qr, { small: true });
            console.log('');
            console.log('⚠️  Abra o WhatsApp no seu celular > Menu (3 pontinhos) > Aparelhos conectados > Conectar um aparelho');
        });

        // Evento quando está pronto
        this.client.on('ready', () => {
            console.log('✅ Bot conectado e funcionando!');
            console.log(`🤖 ${CONFIG.RESTAURANT_NAME} - Chatbot iniciado com sucesso!`);
            console.log('📞 Aguardando mensagens...');
        });

        // Evento quando recebe uma mensagem
        this.client.on('message', async (message) => {
            await this.handleMessage(message);
        });

        // Evento de erro
        this.client.on('auth_failure', () => {
            console.error('❌ Falha na autenticação. Tente novamente.');
        });

        // Evento de desconexão
        this.client.on('disconnected', (reason) => {
            console.log('🔌 Desconectado:', reason);
        });
    }

    async handleMessage(message) {
        try {
            // Evita responder mensagens próprias
            if (message.fromMe) return;

            // Evita responder mensagens de grupos (opcional)
            const chat = await message.getChat();
            if (chat.isGroup) return;

            // Evita processar a mesma mensagem duas vezes
            if (this.processedMessages.has(message.id._serialized)) return;
            this.processedMessages.add(message.id._serialized);

            // Verifica cooldown de 12 horas por cliente
            const clientId = message.from;
            const now = Date.now();
            const lastMessageTime = this.clientCooldowns.get(clientId);
            const cooldownTime = 12 * 60 * 60 * 1000; // 12 horas em milissegundos

            // Se já enviou mensagem há menos de 12h, não responde
            if (lastMessageTime && (now - lastMessageTime) < cooldownTime) {
                const contact = await message.getContact();
                const remainingTime = Math.ceil((cooldownTime - (now - lastMessageTime)) / (60 * 60 * 1000));
                console.log(`⏰ Cliente ${contact.name || contact.pushname || 'Desconhecido'} em cooldown. Restam ${remainingTime}h para nova resposta automática.`);
                return;
            }

            // Log da mensagem recebida
            const contact = await message.getContact();
            console.log(`📩 Mensagem de ${contact.name || contact.pushname || 'Cliente'}: ${message.body}`);

            // Envia a mensagem de boas-vindas
            await this.sendWelcomeMessage(message);

            // Registra o tempo da resposta para o cliente
            this.clientCooldowns.set(clientId, now);
            console.log(`⏰ Cooldown de 12h iniciado para ${contact.name || contact.pushname || 'Cliente'}`);

        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
        }
    }

    async sendWelcomeMessage(message) {
        try {
            // Personaliza a mensagem substituindo as variáveis
            let welcomeText = CONFIG.WELCOME_MESSAGE
                .replace(/{{MENU_URL}}/g, CONFIG.MENU_URL)
                .replace(/{{RESTAURANT_NAME}}/g, CONFIG.RESTAURANT_NAME)
                .replace(/{{OPENING_HOURS}}/g, CONFIG.OPENING_HOURS)
                .replace(/{{FOOD_EMOJI}}/g, CONFIG.FOOD_EMOJI);

            // Envia a mensagem
            await message.reply(welcomeText);

            // Log da resposta enviada
            const contact = await message.getContact();
            console.log(`✅ Resposta enviada para ${contact.name || contact.pushname || 'Cliente'}`);

        } catch (error) {
            console.error('❌ Erro ao enviar mensagem de boas-vindas:', error);
        }
    }

    // Inicia o bot
    start() {
        console.log('🚀 Iniciando o bot...');
        this.client.initialize();
    }

    // Para o bot
    async stop() {
        console.log('🛑 Parando o bot...');
        await this.client.destroy();
    }
}

// Inicialização do bot
const bot = new RestaurantBot();

// Inicia o bot
bot.start();

// Tratamento de sinais para parar o bot graciosamente
process.on('SIGINT', async () => {
    console.log('\n🛑 Recebido sinal de parada...');
    await bot.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Recebido sinal de término...');
    await bot.stop();
    process.exit(0);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Erro não tratado:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exceção não capturada:', error);
    process.exit(1);
});