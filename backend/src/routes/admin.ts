import express from 'express';
import { autenticar } from './auth';
import { Usuario, IUsuario } from '../models/Usuario';
import pool from '../database/connection';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(autenticar);

// Verificar se usuário é admin
const verificarAdmin = (req: any, res: any, next: any) => {
    if (req.usuario.tipo !== 'admin' && req.usuario.tipo !== 'diretor') {
        return res.status(403).json({ erro: 'Acesso restrito a administradores' });
    }
    next();
};

router.use(verificarAdmin);

// Rota para obter dashboard administrativo
router.get('/dashboard', async (req: any, res) => {
    try {
        // Obter estatísticas gerais
        const [estatisticasRows] = await pool.query(
            `SELECT 
                (SELECT COUNT(*) FROM usuarios WHERE tipo = 'aluno' AND ativo = TRUE) as total_alunos,
                (SELECT COUNT(*) FROM usuarios WHERE tipo = 'professor' AND ativo = TRUE) as total_professores,
                (SELECT COUNT(*) FROM turmas) as total_turmas,
                (SELECT COUNT(*) FROM disciplinas) as total_disciplinas,
                (SELECT COUNT(*) FROM biblioteca WHERE ativo = TRUE) as total_materiais_biblioteca,
                (SELECT COUNT(*) FROM papelaria WHERE ativo = TRUE) as total_produtos_papelaria,
                (SELECT COUNT(*) FROM usuarios WHERE ultimo_acesso >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as usuarios_ativos_semana,
                (SELECT AVG((SELECT AVG(valor) FROM notas n WHERE n.aluno_id = u.id)) FROM usuarios u WHERE u.tipo = 'aluno') as media_geral_escola`
        );
        
        // Obter atividade recente
        const [atividadeRows] = await pool.query(
            `SELECT 
                'nota' as tipo,
                n.data_avaliacao as data,
                u.nome_completo as usuario_nome,
                d.nome as detalhe
             FROM notas n
             JOIN usuarios u ON n.professor_id = u.id
             JOIN disciplinas d ON n.disciplina_id = d.id
             WHERE n.data_avaliacao >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             
             UNION ALL
             
             SELECT 
                'frequencia' as tipo,
                f.data_aula as data,
                u.nome_completo as usuario_nome,
                CONCAT('Aula de ', d.nome) as detalhe
             FROM frequencias f
             JOIN usuarios u ON f.professor_id = u.id
             JOIN disciplinas d ON f.disciplina_id = d.id
             WHERE f.data_aula >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             
             UNION ALL
             
             SELECT 
                'mensagem' as tipo,
                m.data_envio as data,
                u.nome_completo as usuario_nome,
                CONCAT('Mensagem para ', u2.nome_completo) as detalhe
             FROM mensagens m
             JOIN usuarios u ON m.remetente_id = u.id
             JOIN usuarios u2 ON m.destinatario_id = u2.id
             WHERE m.data_envio >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             
             ORDER BY data DESC
             LIMIT 10`
        );
        
        // Obter alertas do sistema
        const [alertasRows] = await pool.query(
            `SELECT 
                CASE 
                    WHEN COUNT(*) > 0 THEN 'warning'
                    ELSE 'success'
                END as nivel,
                'Usuários sem senha' as titulo,
                CONCAT(COUNT(*), ' usuários precisam definir senha') as descricao
             FROM usuarios 
             WHERE senha_hash IS NULL AND ativo = TRUE
             
             UNION ALL
             
             SELECT 
                'info' as nivel,
                'Backup do sistema' as titulo,
                'Último backup: ' || COALESCE(DATE_FORMAT(MAX(data_backup), '%d/%m/%Y %H:%i'), 'Nunca') as descricao
             FROM backups
             
             UNION ALL
             
             SELECT 
                CASE 
                    WHEN COUNT(*) > 5 THEN 'danger'
                    WHEN COUNT(*) > 0 THEN 'warning'
                    ELSE 'success'
                END as nivel,
                'Produtos com estoque baixo' as titulo,
                CONCAT(COUNT(*), ' produtos abaixo do nível mínimo') as descricao
             FROM papelaria 
             WHERE quantidade < 10 AND ativo = TRUE`
        );
        
        // Obter distribuição por turma
        const [turmasRows] = await pool.query(
            `SELECT t.nome,
                    COUNT(u.id) as total_alunos,
                    AVG((SELECT AVG(valor) FROM notas n WHERE n.aluno_id = u.id)) as media_turma
             FROM turmas t
             LEFT JOIN usuarios u ON t.id = u.turma_id AND u.tipo = 'aluno'
             GROUP BY t.id
             ORDER BY t.nome`
        );
        
        res.json({
            estatisticas: estatisticasRows[0],
            atividade_recente: atividadeRows,
            alertas: alertasRows,
            turmas: turmasRows
        });
        
    } catch (error) {
        console.error('Erro ao obter dashboard:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para gerenciar usuários
router.get('/usuarios', async (req: any, res) => {
    try {
        const { tipo, turma_id, search, pagina = 1, limite = 20 } = req.query;
        
        let query = `
            SELECT u.*, t.nome as turma_nome
            FROM usuarios u
            LEFT JOIN turmas t ON u.turma_id = t.id
            WHERE u.ativo = TRUE
        `;
        
        const params: any[] = [];
        
        if (tipo) {
            query += ' AND u.tipo = ?';
            params.push(tipo);
        }
        
        if (turma_id) {
            query += ' AND u.turma_id = ?';
            params.push(turma_id);
        }
        
        if (search) {
            query += ' AND (u.nome_completo LIKE ? OR u.numero_processo LIKE ? OR u.email LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        // Contar total
        let countQuery = query.replace('SELECT u.*, t.nome as turma_nome', 'SELECT COUNT(*) as total');
        const [totalRows] = await pool.query(countQuery, params);
        const total = (totalRows as any[])[0].total;
        
        // Adicionar paginação
        const offset = (pagina - 1) * limite;
        query += ' ORDER BY u.nome_completo LIMIT ? OFFSET ?';
        params.push(parseInt(limite), offset);
        
        const [usuariosRows] = await pool.query(query, params);
        
        // Obter tipos disponíveis
        const [tiposRows] = await pool.query(
            'SELECT DISTINCT tipo FROM usuarios WHERE ativo = TRUE ORDER BY tipo'
        );
        
        // Obter turmas disponíveis
        const [turmasRows] = await pool.query(
            'SELECT id, nome FROM turmas ORDER BY nome'
        );
        
        res.json({
            usuarios: usuariosRows,
            total,
            pagina: parseInt(pagina),
            total_paginas: Math.ceil(total / limite),
            filtros: {
                tipos: tiposRows,
                turmas: turmasRows
            }
        });
        
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter detalhes de um usuário
router.get('/usuarios/:id', async (req: any, res) => {
    try {
        const usuarioId = req.params.id;
        
        const [usuarioRows] = await pool.query(
            `SELECT u.*, t.nome as turma_nome
             FROM usuarios u
             LEFT JOIN turmas t ON u.turma_id = t.id
             WHERE u.id = ?`,
            [usuarioId]
        );
        
        if ((usuarioRows as any[]).length === 0) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        
        const usuario = usuarioRows[0];
        
        // Obter informações adicionais baseadas no tipo
        let informacoesAdicionais = {};
        
        if (usuario.tipo === 'aluno') {
            // Obter notas do aluno
            const [notasRows] = await pool.query(
                `SELECT n.*, d.nome as disciplina_nome
                 FROM notas n
                 JOIN disciplinas d ON n.disciplina_id = d.id
                 WHERE n.aluno_id = ?
                 ORDER BY n.data_avaliacao DESC
                 LIMIT 10`,
                [usuarioId]
            );
            
            // Obter frequências do aluno
            const [frequenciasRows] = await pool.query(
                `SELECT f.*, d.nome as disciplina_nome
                 FROM frequencias f
                 JOIN disciplinas d ON f.disciplina_id = d.id
                 WHERE f.aluno_id = ?
                 ORDER BY f.data_aula DESC
                 LIMIT 10`,
                [usuarioId]
            );
            
            // Calcular média geral
            const [mediaRows] = await pool.query(
                `SELECT AVG(valor) as media_geral
                 FROM notas
                 WHERE aluno_id = ?`,
                [usuarioId]
            );
            
            informacoesAdicionais = {
                notas: notasRows,
                frequencias: frequenciasRows,
                media_geral: mediaRows[0]?.media_geral || 0
            };
        } else if (usuario.tipo === 'professor') {
            // Obter disciplinas lecionadas
            const [disciplinasRows] = await pool.query(
                `SELECT d.*, 
                        COUNT(DISTINCT m.aluno_id) as total_alunos
                 FROM disciplinas d
                 LEFT JOIN matriculas m ON d.id = m.disciplina_id
                 WHERE d.professor_id = ?
                 GROUP BY d.id`,
                [usuarioId]
            );
            
            // Obter turmas responsáveis
            const [turmasRows] = await pool.query(
                `SELECT t.*, 
                        COUNT(DISTINCT u.id) as total_alunos
                 FROM turmas t
                 LEFT JOIN usuarios u ON t.id = u.turma_id AND u.tipo = 'aluno'
                 WHERE t.professor_responsavel = ?
                 GROUP BY t.id`,
                [usuarioId]
            );
            
            informacoesAdicionais = {
                disciplinas: disciplinasRows,
                turmas: turmasRows
            };
        }
        
        res.json({
            usuario,
            informacoes_adicionais: informacoesAdicionais
        });
        
    } catch (error) {
        console.error('Erro ao obter usuário:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para criar usuário
router.post('/usuarios', [
    body('numero_processo').notEmpty().withMessage('Número de processo é obrigatório'),
    body('nome_completo').notEmpty().withMessage('Nome completo é obrigatório'),
    body('email').isEmail().withMessage('Email inválido'),
    body('tipo').isIn(['aluno', 'professor', 'admin', 'diretor', 'coordenador', 'encarregado']).withMessage('Tipo inválido'),
    body('senha').optional().isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres')
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const usuarioData: IUsuario = req.body;
        
        // Verificar se número de processo já existe
        const usuarioExistente = await Usuario.buscarPorNumeroProcesso(usuarioData.numero_processo);
        
        if (usuarioExistente) {
            return res.status(400).json({ erro: 'Número de processo já existe' });
        }
        
        // Gerar avatar
        if (!usuarioData.avatar) {
            usuarioData.avatar = usuarioData.nome_completo
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);
        }
        
        // Se senha for fornecida, criar hash
        if (usuarioData.senha_hash) {
            usuarioData.senha_hash = await bcrypt.hash(usuarioData.senha_hash, 10);
        }
        
        const novoUsuario = await Usuario.criar(usuarioData);
        
        // Remover senha_hash da resposta
        delete (novoUsuario as any).senha_hash;
        
        res.status(201).json({
            mensagem: 'Usuário criado com sucesso',
            usuario: novoUsuario
        });
        
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para atualizar usuário
router.put('/usuarios/:id', [
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('tipo').optional().isIn(['aluno', 'professor', 'admin', 'diretor', 'coordenador', 'encarregado']).withMessage('Tipo inválido'),
    body('ativo').optional().isBoolean().withMessage('Ativo deve ser booleano')
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const usuarioId = req.params.id;
        const dadosAtualizacao = req.body;
        
        // Não permitir atualizar senha por esta rota
        delete dadosAtualizacao.senha_hash;
        
        // Se estiver atualizando número de processo, verificar se já existe
        if (dadosAtualizacao.numero_processo) {
            const usuarioExistente = await Usuario.buscarPorNumeroProcesso(dadosAtualizacao.numero_processo);
            
            if (usuarioExistente && usuarioExistente.id !== parseInt(usuarioId)) {
                return res.status(400).json({ erro: 'Número de processo já existe' });
            }
        }
        
        const atualizado = await Usuario.atualizar(parseInt(usuarioId), dadosAtualizacao);
        
        if (!atualizado) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        
        const usuarioAtualizado = await Usuario.buscarPorId(parseInt(usuarioId));
        delete (usuarioAtualizado as any).senha_hash;
        
        res.json({
            mensagem: 'Usuário atualizado com sucesso',
            usuario: usuarioAtualizado
        });
        
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para redefinir senha do usuário
router.put('/usuarios/:id/redefinir-senha', [
    body('nova_senha').isLength({ min: 6 }).withMessage('Nova senha deve ter pelo menos 6 caracteres')
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const usuarioId = req.params.id;
        const { nova_senha } = req.body;
        
        const sucesso = await Usuario.atualizarSenha(parseInt(usuarioId), nova_senha);
        
        if (!sucesso) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        
        res.json({ mensagem: 'Senha redefinida com sucesso' });
        
    } catch (error) {
        console.error('Erro ao redefinir senha:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para desativar usuário
router.delete('/usuarios/:id', async (req: any, res) => {
    try {
        const usuarioId = req.params.id;
        
        // Soft delete - marcar como inativo
        const [result] = await pool.query(
            'UPDATE usuarios SET ativo = FALSE WHERE id = ?',
            [usuarioId]
        );
        
        if ((result as any).affectedRows === 0) {
            return res.status(404).json({ erro: 'Usuário não encontrado' });
        }
        
        res.json({ mensagem: 'Usuário desativado com sucesso' });
        
    } catch (error) {
        console.error('Erro ao desativar usuário:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para gerenciar turmas
router.get('/turmas', async (req: any, res) => {
    try {
        const [turmasRows] = await pool.query(
            `SELECT t.*, 
                    u.nome_completo as professor_nome,
                    COUNT(DISTINCT u2.id) as total_alunos
             FROM turmas t
             LEFT JOIN usuarios u ON t.professor_responsavel = u.id
             LEFT JOIN usuarios u2 ON t.id = u2.turma_id AND u2.tipo = 'aluno'
             GROUP BY t.id
             ORDER BY t.nome`
        );
        
        // Obter professores disponíveis para atribuir como responsáveis
        const [professoresRows] = await pool.query(
            `SELECT id, nome_completo, departamento 
             FROM usuarios 
             WHERE tipo IN ('professor', 'coordenador') AND ativo = TRUE
             ORDER BY nome_completo`
        );
        
        res.json({
            turmas: turmasRows,
            professores: professoresRows
        });
        
    } catch (error) {
        console.error('Erro ao listar turmas:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para criar turma
router.post('/turmas', [
    body('nome').notEmpty().withMessage('Nome da turma é obrigatório'),
    body('curso').notEmpty().withMessage('Curso é obrigatório'),
    body('ano_letivo').notEmpty().withMessage('Ano letivo é obrigatório'),
    body('sala').notEmpty().withMessage('Sala é obrigatória'),
    body('professor_responsavel').optional().isInt().withMessage('ID do professor inválido')
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const turmaData = req.body;
        
        const [result] = await pool.query(
            'INSERT INTO turmas SET ?',
            [turmaData]
        );
        
        const turmaId = (result as any).insertId;
        
        const [turmaRows] = await pool.query(
            `SELECT t.*, u.nome_completo as professor_nome
             FROM turmas t
             LEFT JOIN usuarios u ON t.professor_responsavel = u.id
             WHERE t.id = ?`,
            [turmaId]
        );
        
        res.status(201).json({
            mensagem: 'Turma criada com sucesso',
            turma: turmaRows[0]
        });
        
    } catch (error) {
        console.error('Erro ao criar turma:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para gerenciar disciplinas
router.get('/disciplinas', async (req: any, res) => {
    try {
        const [disciplinasRows] = await pool.query(
            `SELECT d.*, 
                    u.nome_completo as professor_nome,
                    COUNT(DISTINCT m.aluno_id) as total_alunos_matriculados
             FROM disciplinas d
             LEFT JOIN usuarios u ON d.professor_id = u.id
             LEFT JOIN matriculas m ON d.id = m.disciplina_id AND m.status = 'matriculado'
             GROUP BY d.id
             ORDER BY d.curso, d.ano, d.semestre, d.nome`
        );
        
        // Obter professores disponíveis
        const [professoresRows] = await pool.query(
            `SELECT id, nome_completo, departamento 
             FROM usuarios 
             WHERE tipo IN ('professor', 'coordenador') AND ativo = TRUE
             ORDER BY nome_completo`
        );
        
        // Obter cursos disponíveis
        const [cursosRows] = await pool.query(
            'SELECT DISTINCT curso FROM disciplinas ORDER BY curso'
        );
        
        res.json({
            disciplinas: disciplinasRows,
            professores: professoresRows,
            cursos: cursosRows
        });
        
    } catch (error) {
        console.error('Erro ao listar disciplinas:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para criar disciplina
router.post('/disciplinas', [
    body('nome').notEmpty().withMessage('Nome da disciplina é obrigatório'),
    body('codigo').notEmpty().withMessage('Código da disciplina é obrigatório'),
    body('curso').notEmpty().withMessage('Curso é obrigatório'),
    body('ano').isInt({ min: 1, max: 3 }).withMessage('Ano deve ser entre 1 e 3'),
    body('semestre').isInt({ min: 1, max: 2 }).withMessage('Semestre deve ser 1 ou 2'),
    body('carga_horaria').isInt({ min: 1 }).withMessage('Carga horária deve ser positiva'),
    body('professor_id').optional().isInt().withMessage('ID do professor inválido')
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const disciplinaData = req.body;
        
        // Verificar se código já existe
        const [disciplinaExistenteRows] = await pool.query(
            'SELECT id FROM disciplinas WHERE codigo = ?',
            [disciplinaData.codigo]
        );
        
        if ((disciplinaExistenteRows as any[]).length > 0) {
            return res.status(400).json({ erro: 'Código da disciplina já existe' });
        }
        
        const [result] = await pool.query(
            'INSERT INTO disciplinas SET ?',
            [disciplinaData]
        );
        
        const disciplinaId = (result as any).insertId;
        
        const [disciplinaRows] = await pool.query(
            `SELECT d.*, u.nome_completo as professor_nome
             FROM disciplinas d
             LEFT JOIN usuarios u ON d.professor_id = u.id
             WHERE d.id = ?`,
            [disciplinaId]
        );
        
        res.status(201).json({
            mensagem: 'Disciplina criada com sucesso',
            disciplina: disciplinaRows[0]
        });
        
    } catch (error) {
        console.error('Erro ao criar disciplina:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para gerenciar matrículas
router.post('/matriculas/massa', [
    body('aluno_id').isInt().withMessage('ID do aluno inválido'),
    body('disciplinas').isArray().withMessage('Disciplinas deve ser um array'),
    body('disciplinas.*.disciplina_id').isInt().withMessage('ID da disciplina inválido'),
    body('disciplinas.*.turma_id').isInt().withMessage('ID da turma inválido'),
    body('ano_letivo').notEmpty().withMessage('Ano letivo é obrigatório')
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const { aluno_id, disciplinas, ano_letivo } = req.body;
        
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Remover matrículas antigas para este ano letivo
            await connection.query(
                'DELETE FROM matriculas WHERE aluno_id = ? AND ano_letivo = ?',
                [aluno_id, ano_letivo]
            );
            
            // Inserir novas matrículas
            for (const disciplina of disciplinas) {
                await connection.query(
                    'INSERT INTO matriculas (aluno_id, disciplina_id, turma_id, ano_letivo, status) VALUES (?, ?, ?, ?, "matriculado")',
                    [aluno_id, disciplina.disciplina_id, disciplina.turma_id, ano_letivo]
                );
            }
            
            await connection.commit();
            
            res.json({
                mensagem: 'Matrículas realizadas com sucesso',
                total_matriculas: disciplinas.length
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Erro ao realizar matrículas:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter configurações do sistema
router.get('/configuracoes', async (req: any, res) => {
    try {
        const [configRows] = await pool.query(
            'SELECT * FROM config_sistema ORDER BY chave'
        );
        
        res.json({ configuracoes: configRows });
        
    } catch (error) {
        console.error('Erro ao obter configurações:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para atualizar configurações do sistema
router.put('/configuracoes', [
    body('configuracoes').isArray().withMessage('Configurações deve ser um array'),
    body('configuracoes.*.chave').notEmpty().withMessage('Chave é obrigatória'),
    body('configuracoes.*.valor').notEmpty().withMessage('Valor é obrigatório')
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const { configuracoes } = req.body;
        
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            for (const config of configuracoes) {
                await connection.query(
                    'INSERT INTO config_sistema (chave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = ?',
                    [config.chave, config.valor, config.valor]
                );
            }
            
            await connection.commit();
            
            res.json({ mensagem: 'Configurações atualizadas com sucesso' });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Erro ao atualizar configurações:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

export default router;