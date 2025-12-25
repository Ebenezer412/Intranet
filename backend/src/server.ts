import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';

// Carregar variáveis de ambiente
dotenv.config();

// Importar rotas
import authRoutes from './routes/auth';
import alunoRoutes from './routes/alunos';
import professorRoutes from './routes/professores';
import adminRoutes from './routes/admin';
import bibliotecaRoutes from './routes/biblioteca';

// Criar aplicação Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar middlewares
app.use(helmet()); // Segurança
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5500',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rota de saúde
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online',
        timestamp: new Date().toISOString(),
        service: 'IMEL Intranet API'
    });
});

// Configurar rotas
app.use('/api/auth', authRoutes);
app.use('/api/aluno', alunoRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/biblioteca', bibliotecaRoutes);

// Middleware para rotas não encontradas
app.use((req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada' });
});

// Middleware de erro global
app.use((err: any, req: any, res: any, next: any) => {
    console.error('Erro não tratado:', err);
    
    // Erro de validação do multer
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ erro: 'Arquivo muito grande. Tamanho máximo: 50MB' });
        }
    }
    
    // Erro de tipo de arquivo
    if (err.message && err.message.includes('Tipo de arquivo não permitido')) {
        return res.status(400).json({ erro: 'Tipo de arquivo não permitido' });
    }
    
    res.status(500).json({ 
        erro: 'Erro interno do servidor',
        mensagem: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📚 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
});

export default app;