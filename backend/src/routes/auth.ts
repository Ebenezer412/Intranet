import express from 'express';
import jwt from 'jsonwebtoken';
import { Usuario, IUsuario } from '../models/Usuario';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Middleware de autenticação
export const autenticar = (req: any, res: any, next: any) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'imel_secret_key');
        req.usuario = decoded;
        next();
    } catch (error) {
        res.status(401).json({ erro: 'Token inválido.' });
    }
};

// Rota de login
router.post('/login', [
    body('numero_processo').notEmpty().withMessage('Número de processo é obrigatório'),
    body('senha').notEmpty().withMessage('Senha é obrigatória')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const { numero_processo, senha } = req.body;
        
        const usuario = await Usuario.verificarCredenciais(numero_processo, senha);
        
        if (!usuario) {
            return res.status(401).json({ erro: 'Credenciais inválidas' });
        }
        
        // Gerar token JWT
        const token = jwt.sign(
            { 
                id: usuario.id,
                numero_processo: usuario.numero_processo,
                tipo: usuario.tipo,
                nome: usuario.nome_completo
            },
            process.env.JWT_SECRET || 'imel_secret_key',
            { expiresIn: '8h' }
        );
        
        res.json({
            mensagem: 'Login bem-sucedido',
            token,
            usuario: {
                id: usuario.id,
                numero_processo: usuario.numero_processo,
                nome_completo: usuario.nome_completo,
                email: usuario.email,
                tipo: usuario.tipo,
                avatar: usuario.avatar,
                turma_id: usuario.turma_id,
                departamento: usuario.departamento,
                cargo: usuario.cargo
            }
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota de registro (primeiro acesso)
router.post('/registrar', [
    body('numero_processo').notEmpty().withMessage('Número de processo é obrigatório'),
    body('senha').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres'),
    body('confirmar_senha').custom((value, { req }) => {
        if (value !== req.body.senha) {
            throw new Error('As senhas não coincidem');
        }
        return true;
    })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const { numero_processo, senha } = req.body;
        
        // Buscar usuário pelo número de processo
        const usuarioExistente = await Usuario.buscarPorNumeroProcesso(numero_processo);
        
        if (!usuarioExistente) {
            return res.status(404).json({ erro: 'Número de processo não encontrado' });
        }
        
        if (usuarioExistente.senha_hash) {
            return res.status(400).json({ erro: 'Usuário já possui senha definida' });
        }
        
        // Atualizar senha
        await Usuario.atualizarSenha(usuarioExistente.id!, senha);
        
        // Gerar token JWT
        const token = jwt.sign(
            { 
                id: usuarioExistente.id,
                numero_processo: usuarioExistente.numero_processo,
                tipo: usuarioExistente.tipo,
                nome: usuarioExistente.nome_completo
            },
            process.env.JWT_SECRET || 'imel_secret_key',
            { expiresIn: '8h' }
        );
        
        res.json({
            mensagem: 'Registro concluído com sucesso',
            token,
            usuario: {
                id: usuarioExistente.id,
                numero_processo: usuarioExistente.numero_processo,
                nome_completo: usuarioExistente.nome_completo,
                email: usuarioExistente.email,
                tipo: usuarioExistente.tipo,
                avatar: usuarioExistente.avatar,
                turma_id: usuarioExistente.turma_id,
                departamento: usuarioExistente.departamento,
                cargo: usuarioExistente.cargo
            }
        });
    } catch (error) {
        console.error('Erro no registro:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota de verificação de token
router.get('/verificar', autenticar, (req, res) => {
    res.json({ mensagem: 'Token válido', usuario: req.usuario });
});

// Rota para obter perfil do usuário
router.get('/perfil', autenticar, async (req: any, res) => {
    try {
        const usuario = await Usuario.buscarPorId(req.usuario.id);
        
        if (!usuario) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        
        // Remover informações sensíveis
        delete (usuario as any).senha_hash;
        
        res.json({ usuario });
    } catch (error) {
        console.error('Erro ao buscar perfil:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para atualizar perfil
router.put('/perfil', autenticar, [
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('telefone').optional().isMobilePhone('any').withMessage('Telefone inválido')
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const dadosAtualizacao = req.body;
        delete dadosAtualizacao.senha_hash; // Não permitir atualizar senha por esta rota
        delete dadosAtualizacao.numero_processo; // Não permitir alterar número de processo
        
        const atualizado = await Usuario.atualizar(req.usuario.id, dadosAtualizacao);
        
        if (!atualizado) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        
        const usuarioAtualizado = await Usuario.buscarPorId(req.usuario.id);
        delete (usuarioAtualizado as any).senha_hash;
        
        res.json({
            mensagem: 'Perfil atualizado com sucesso',
            usuario: usuarioAtualizado
        });
    } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para alterar senha
router.put('/alterar-senha', autenticar, [
    body('senha_atual').notEmpty().withMessage('Senha atual é obrigatória'),
    body('nova_senha').isLength({ min: 6 }).withMessage('Nova senha deve ter pelo menos 6 caracteres'),
    body('confirmar_senha').custom((value, { req }) => {
        if (value !== req.body.nova_senha) {
            throw new Error('As senhas não coincidem');
        }
        return true;
    })
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const { senha_atual, nova_senha } = req.body;
        
        // Verificar senha atual
        const usuario = await Usuario.buscarPorId(req.usuario.id);
        
        if (!usuario || !usuario.senha_hash) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        
        const bcrypt = require('bcryptjs');
        const senhaValida = await bcrypt.compare(senha_atual, usuario.senha_hash);
        
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Senha atual incorreta' });
        }
        
        // Atualizar senha
        await Usuario.atualizarSenha(req.usuario.id, nova_senha);
        
        res.json({ mensagem: 'Senha alterada com sucesso' });
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

export default router;