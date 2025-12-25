import express from 'express';
import { autenticar } from './auth';
import { Biblioteca, IItemBiblioteca } from '../models/Biblioteca';
import pool from '../database/connection';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/biblioteca';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'video/mp4',
            'video/mpeg',
            'application/zip',
            'application/x-rar-compressed'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido'));
        }
    }
});

// Todas as rotas requerem autenticação
router.use(autenticar);

// Rota para listar itens da biblioteca
router.get('/', async (req: any, res) => {
    try {
        const { 
            curso, 
            disciplina_id, 
            tipo, 
            categoria, 
            search, 
            pagina = 1, 
            limite = 20 
        } = req.query;
        
        const filtros = {
            curso: curso as string,
            disciplina_id: disciplina_id ? parseInt(disciplina_id as string) : undefined,
            tipo: tipo as string,
            categoria: categoria as string,
            search: search as string
        };
        
        const resultado = await Biblioteca.listar(filtros, parseInt(pagina as string), parseInt(limite as string));
        
        // Obter cursos disponíveis
        const [cursosRows] = await pool.query(
            'SELECT DISTINCT curso FROM biblioteca WHERE ativo = TRUE ORDER BY curso'
        );
        
        // Obter categorias disponíveis
        const [categoriasRows] = await pool.query(
            'SELECT DISTINCT categoria FROM biblioteca WHERE ativo = TRUE ORDER BY categoria'
        );
        
        // Obter tipos disponíveis
        const [tiposRows] = await pool.query(
            'SELECT DISTINCT tipo FROM biblioteca WHERE ativo = TRUE ORDER BY tipo'
        );
        
        // Obter disciplinas disponíveis
        const [disciplinasRows] = await pool.query(
            `SELECT d.id, d.nome, d.curso 
             FROM disciplinas d
             WHERE EXISTS (SELECT 1 FROM biblioteca b WHERE b.disciplina_id = d.id AND b.ativo = TRUE)
             ORDER BY d.curso, d.nome`
        );
        
        res.json({
            itens: resultado.itens,
            total: resultado.total,
            pagina: parseInt(pagina as string),
            total_paginas: Math.ceil(resultado.total / parseInt(limite as string)),
            filtros_disponiveis: {
                cursos: cursosRows,
                categorias: categoriasRows,
                tipos: tiposRows,
                disciplinas: disciplinasRows
            }
        });
        
    } catch (error) {
        console.error('Erro ao listar biblioteca:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter detalhes de um item
router.get('/:id', async (req: any, res) => {
    try {
        const itemId = req.params.id;
        
        const item = await Biblioteca.buscarPorId(parseInt(itemId));
        
        if (!item) {
            return res.status(404).json({ erro: 'Item não encontrado' });
        }
        
        res.json({ item });
        
    } catch (error) {
        console.error('Erro ao obter item:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para adicionar item (com upload de arquivo)
router.post('/', upload.single('arquivo'), [
    body('titulo').notEmpty().withMessage('Título é obrigatório'),
    body('tipo').isIn(['livro', 'artigo', 'video', 'apostila', 'software']).withMessage('Tipo inválido'),
    body('categoria').notEmpty().withMessage('Categoria é obrigatória'),
    body('curso').notEmpty().withMessage('Curso é obrigatório'),
    body('descricao').optional().isString()
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Limpar arquivo enviado se houver erro
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        if (!req.file) {
            return res.status(400).json({ erro: 'Arquivo é obrigatório' });
        }
        
        const usuarioId = req.usuario.id;
        
        // Verificar permissões (admin, diretor, professor, coordenador)
        const tiposPermitidos = ['admin', 'diretor', 'professor', 'coordenador'];
        if (!tiposPermitidos.includes(req.usuario.tipo)) {
            fs.unlinkSync(req.file.path);
            return res.status(403).json({ erro: 'Acesso não autorizado' });
        }
        
        // Determinar tamanho do arquivo
        const tamanho = formatBytes(req.file.size);
        
        // Determinar formato do arquivo
        const formato = path.extname(req.file.originalname).substring(1).toUpperCase();
        
        const itemData: IItemBiblioteca = {
            titulo: req.body.titulo,
            autor: req.body.autor,
            tipo: req.body.tipo,
            categoria: req.body.categoria,
            curso: req.body.curso,
            disciplina_id: req.body.disciplina_id ? parseInt(req.body.disciplina_id) : undefined,
            arquivo_url: `/uploads/biblioteca/${req.file.filename}`,
            descricao: req.body.descricao,
            tamanho: tamanho,
            formato: formato,
            downloads: 0,
            uploader_id: usuarioId,
            ativo: true
        };
        
        const novoItem = await Biblioteca.adicionar(itemData);
        
        res.status(201).json({
            mensagem: 'Item adicionado à biblioteca com sucesso',
            item: novoItem
        });
        
    } catch (error) {
        // Limpar arquivo em caso de erro
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        
        console.error('Erro ao adicionar item:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Função auxiliar para formatar bytes
function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Rota para incrementar contador de downloads
router.post('/:id/download', async (req: any, res) => {
    try {
        const itemId = req.params.id;
        
        const item = await Biblioteca.buscarPorId(parseInt(itemId));
        
        if (!item) {
            return res.status(404).json({ erro: 'Item não encontrado' });
        }
        
        // Incrementar contador de downloads
        await Biblioteca.incrementarDownloads(parseInt(itemId));
        
        // Retornar URL do arquivo para download
        res.json({
            mensagem: 'Download registrado',
            arquivo_url: item.arquivo_url,
            nome_arquivo: `${item.titulo.replace(/[^a-z0-9]/gi, '_')}.${item.formato?.toLowerCase()}`
        });
        
    } catch (error) {
        console.error('Erro ao registrar download:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para atualizar item (apenas uploader ou admin)
router.put('/:id', [
    body('titulo').optional().notEmpty().withMessage('Título não pode ser vazio'),
    body('tipo').optional().isIn(['livro', 'artigo', 'video', 'apostila', 'software']).withMessage('Tipo inválido'),
    body('ativo').optional().isBoolean().withMessage('Ativo deve ser booleano')
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const itemId = req.params.id;
        const usuarioId = req.usuario.id;
        const usuarioTipo = req.usuario.tipo;
        
        // Verificar se item existe
        const item = await Biblioteca.buscarPorId(parseInt(itemId));
        
        if (!item) {
            return res.status(404).json({ erro: 'Item não encontrado' });
        }
        
        // Verificar permissões
        const isAdmin = ['admin', 'diretor'].includes(usuarioTipo);
        const isUploader = item.uploader_id === usuarioId;
        
        if (!isAdmin && !isUploader) {
            return res.status(403).json({ erro: 'Acesso não autorizado' });
        }
        
        // Atualizar item
        const dadosAtualizacao = req.body;
        const atualizado = await Biblioteca.atualizar(parseInt(itemId), dadosAtualizacao);
        
        if (!atualizado) {
            return res.status(404).json({ erro: 'Item não encontrado' });
        }
        
        const itemAtualizado = await Biblioteca.buscarPorId(parseInt(itemId));
        
        res.json({
            mensagem: 'Item atualizado com sucesso',
            item: itemAtualizado
        });
        
    } catch (error) {
        console.error('Erro ao atualizar item:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para eliminar item (soft delete)
router.delete('/:id', async (req: any, res) => {
    try {
        const itemId = req.params.id;
        const usuarioId = req.usuario.id;
        const usuarioTipo = req.usuario.tipo;
        
        // Verificar se item existe
        const item = await Biblioteca.buscarPorId(parseInt(itemId));
        
        if (!item) {
            return res.status(404).json({ erro: 'Item não encontrado' });
        }
        
        // Verificar permissões
        const isAdmin = ['admin', 'diretor'].includes(usuarioTipo);
        const isUploader = item.uploader_id === usuarioId;
        
        if (!isAdmin && !isUploader) {
            return res.status(403).json({ erro: 'Acesso não autorizado' });
        }
        
        // Soft delete
        const eliminado = await Biblioteca.eliminar(parseInt(itemId));
        
        if (!eliminado) {
            return res.status(404).json({ erro: 'Item não encontrado' });
        }
        
        res.json({ mensagem: 'Item eliminado com sucesso' });
        
    } catch (error) {
        console.error('Erro ao eliminar item:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter estatísticas da biblioteca
router.get('/estatisticas', async (req: any, res) => {
    try {
        const [estatisticasRows] = await pool.query(
            `SELECT 
                COUNT(*) as total_itens,
                SUM(downloads) as total_downloads,
                COUNT(DISTINCT curso) as total_cursos,
                COUNT(DISTINCT categoria) as total_categorias,
                (SELECT COUNT(*) FROM biblioteca WHERE tipo = 'livro' AND ativo = TRUE) as total_livros,
                (SELECT COUNT(*) FROM biblioteca WHERE tipo = 'video' AND ativo = TRUE) as total_videos,
                (SELECT COUNT(*) FROM biblioteca WHERE tipo = 'apostila' AND ativo = TRUE) as total_apostilas
             FROM biblioteca 
             WHERE ativo = TRUE`
        );
        
        // Obter itens mais baixados
        const [maisBaixadosRows] = await pool.query(
            `SELECT titulo, downloads, tipo, curso
             FROM biblioteca 
             WHERE ativo = TRUE
             ORDER BY downloads DESC
             LIMIT 10`
        );
        
        // Obter cursos com mais materiais
        const [cursosRows] = await pool.query(
            `SELECT curso, COUNT(*) as total_materiais, SUM(downloads) as total_downloads
             FROM biblioteca 
             WHERE ativo = TRUE
             GROUP BY curso
             ORDER BY total_materiais DESC`
        );
        
        res.json({
            estatisticas: estatisticasRows[0],
            mais_baixados: maisBaixadosRows,
            cursos: cursosRows
        });
        
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

export default router;