import express from 'express';
import { autenticar } from './auth';
import { Nota, INota } from '../models/Nota';
import { Frequencia, IFrequencia } from '../models/Frequencia';
import pool from '../database/connection';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(autenticar);

// Verificar se usuário é professor
const verificarProfessor = (req: any, res: any, next: any) => {
    if (req.usuario.tipo !== 'professor' && req.usuario.tipo !== 'coordenador') {
        return res.status(403).json({ erro: 'Acesso restrito a professores' });
    }
    next();
};

router.use(verificarProfessor);

// Rota para obter dashboard do professor
router.get('/dashboard', async (req: any, res) => {
    try {
        const professorId = req.usuario.id;
        
        // Obter turmas do professor
        const [turmasRows] = await pool.query(
            `SELECT t.*, 
                    COUNT(DISTINCT u.id) as total_alunos
             FROM turmas t
             LEFT JOIN usuarios u ON t.id = u.turma_id AND u.tipo = 'aluno'
             WHERE t.professor_responsavel = ?
             GROUP BY t.id`,
            [professorId]
        );
        
        // Obter disciplinas lecionadas
        const [disciplinasRows] = await pool.query(
            `SELECT d.*, 
                    COUNT(DISTINCT m.aluno_id) as total_alunos
             FROM disciplinas d
             LEFT JOIN matriculas m ON d.id = m.disciplina_id
             WHERE d.professor_id = ?
             GROUP BY d.id`,
            [professorId]
        );
        
        // Obter avaliações pendentes
        const [avaliacoesRows] = await pool.query(
            `SELECT n.*, d.nome as disciplina_nome,
                    u.nome_completo as aluno_nome
             FROM notas n
             JOIN disciplinas d ON n.disciplina_id = d.id
             JOIN usuarios u ON n.aluno_id = u.id
             WHERE n.professor_id = ?
             AND n.valor IS NULL
             ORDER BY n.data_avaliacao ASC`,
            [professorId]
        );
        
        // Obter mensagens não lidas
        const [mensagensRows] = await pool.query(
            `SELECT COUNT(*) as total 
             FROM mensagens 
             WHERE destinatario_id = ? AND lida = FALSE`,
            [professorId]
        );
        
        // Obter próximas aulas
        const hoje = new Date().toISOString().split('T')[0];
        const [aulasRows] = await pool.query(
            `SELECT e.* 
             FROM eventos e
             WHERE e.organizador_id = ?
             AND DATE(e.data_inicio) >= ?
             AND e.tipo = 'academico'
             ORDER BY e.data_inicio ASC
             LIMIT 5`,
            [professorId, hoje]
        );
        
        res.json({
            turmas: turmasRows,
            disciplinas: disciplinasRows,
            avaliacoes_pendentes: avaliacoesRows,
            total_mensagens_nao_lidas: mensagensRows[0]?.total || 0,
            proximas_aulas: aulasRows,
            estatisticas: {
                total_turmas: turmasRows.length,
                total_disciplinas: disciplinasRows.length,
                total_alunos: disciplinasRows.reduce((acc: number, d: any) => acc + (d.total_alunos || 0), 0),
                avaliacoes_pendentes: avaliacoesRows.length
            }
        });
        
    } catch (error) {
        console.error('Erro ao obter dashboard:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter turmas do professor
router.get('/turmas', async (req: any, res) => {
    try {
        const professorId = req.usuario.id;
        
        const [turmasRows] = await pool.query(
            `SELECT t.*, 
                    COUNT(DISTINCT u.id) as total_alunos,
                    (SELECT COUNT(*) FROM disciplinas WHERE professor_id = ?) as total_disciplinas
             FROM turmas t
             LEFT JOIN usuarios u ON t.id = u.turma_id AND u.tipo = 'aluno'
             WHERE t.professor_responsavel = ?
             GROUP BY t.id`,
            [professorId, professorId]
        );
        
        res.json({ turmas: turmasRows });
        
    } catch (error) {
        console.error('Erro ao obter turmas:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter alunos de uma turma
router.get('/turmas/:turmaId/alunos', async (req: any, res) => {
    try {
        const professorId = req.usuario.id;
        const turmaId = req.params.turmaId;
        
        // Verificar se professor é responsável pela turma
        const [turmaRows] = await pool.query(
            'SELECT id FROM turmas WHERE id = ? AND professor_responsavel = ?',
            [turmaId, professorId]
        );
        
        if ((turmaRows as any[]).length === 0) {
            return res.status(403).json({ erro: 'Acesso não autorizado a esta turma' });
        }
        
        // Obter alunos da turma
        const [alunosRows] = await pool.query(
            `SELECT u.id, u.numero_processo, u.nome_completo, u.email, u.telefone,
                    (SELECT AVG(valor) FROM notas WHERE aluno_id = u.id) as media_geral
             FROM usuarios u
             WHERE u.turma_id = ? AND u.tipo = 'aluno'
             ORDER BY u.nome_completo`,
            [turmaId]
        );
        
        res.json({ alunos: alunosRows });
        
    } catch (error) {
        console.error('Erro ao obter alunos:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para inserir/atualizar notas
router.post('/notas', [
    body('aluno_id').isInt().withMessage('ID do aluno inválido'),
    body('disciplina_id').isInt().withMessage('ID da disciplina inválido'),
    body('tipo_avaliacao').isIn(['teste1', 'teste2', 'projeto', 'participacao', 'exame']).withMessage('Tipo de avaliação inválido'),
    body('valor').isFloat({ min: 0, max: 20 }).withMessage('Valor deve estar entre 0 e 20'),
    body('peso').optional().isFloat({ min: 0, max: 1 }).withMessage('Peso deve estar entre 0 e 1'),
    body('data_avaliacao').optional().isDate().withMessage('Data inválida'),
    body('observacoes').optional().isString()
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const professorId = req.usuario.id;
        const notaData: INota = {
            ...req.body,
            professor_id: professorId,
            peso: req.body.peso || 1.0,
            data_avaliacao: req.body.data_avaliacao ? new Date(req.body.data_avaliacao) : new Date()
        };
        
        // Verificar se professor leciona a disciplina
        const [disciplinaRows] = await pool.query(
            'SELECT id FROM disciplinas WHERE id = ? AND professor_id = ?',
            [notaData.disciplina_id, professorId]
        );
        
        if ((disciplinaRows as any[]).length === 0) {
            return res.status(403).json({ erro: 'Professor não leciona esta disciplina' });
        }
        
        // Verificar se aluno está matriculado na disciplina
        const [matriculaRows] = await pool.query(
            'SELECT id FROM matriculas WHERE aluno_id = ? AND disciplina_id = ? AND status = "matriculado"',
            [notaData.aluno_id, notaData.disciplina_id]
        );
        
        if ((matriculaRows as any[]).length === 0) {
            return res.status(400).json({ erro: 'Aluno não matriculado nesta disciplina' });
        }
        
        // Verificar se já existe nota para este tipo de avaliação
        const [notaExistenteRows] = await pool.query(
            `SELECT id FROM notas 
             WHERE aluno_id = ? 
             AND disciplina_id = ? 
             AND tipo_avaliacao = ?
             AND DATE(data_avaliacao) = DATE(?)`,
            [notaData.aluno_id, notaData.disciplina_id, notaData.tipo_avaliacao, notaData.data_avaliacao]
        );
        
        let nota;
        
        if ((notaExistenteRows as any[]).length > 0) {
            // Atualizar nota existente
            const notaId = (notaExistenteRows[0] as any).id;
            await Nota.atualizar(notaId, {
                valor: notaData.valor,
                peso: notaData.peso,
                observacoes: notaData.observacoes
            });
            
            nota = await Nota.buscarPorId(notaId);
        } else {
            // Inserir nova nota
            nota = await Nota.inserir(notaData);
        }
        
        // Calcular nova média do aluno
        const media = await Nota.calcularMedia(notaData.aluno_id, notaData.disciplina_id);
        
        res.json({
            mensagem: 'Nota registrada com sucesso',
            nota,
            media_aluno: media
        });
        
    } catch (error) {
        console.error('Erro ao registrar nota:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para registrar frequências em massa
router.post('/frequencias/massa', [
    body('disciplina_id').isInt().withMessage('ID da disciplina inválido'),
    body('data_aula').isDate().withMessage('Data da aula inválida'),
    body('registros').isArray().withMessage('Registros devem ser um array'),
    body('registros.*.aluno_id').isInt().withMessage('ID do aluno inválido'),
    body('registros.*.status').isIn(['presente', 'falta', 'justificado', 'atraso']).withMessage('Status inválido'),
    body('registros.*.justificativa').optional().isString()
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const professorId = req.usuario.id;
        const { disciplina_id, data_aula, registros } = req.body;
        
        // Verificar se professor leciona a disciplina
        const [disciplinaRows] = await pool.query(
            'SELECT id FROM disciplinas WHERE id = ? AND professor_id = ?',
            [disciplina_id, professorId]
        );
        
        if ((disciplinaRows as any[]).length === 0) {
            return res.status(403).json({ erro: 'Professor não leciona esta disciplina' });
        }
        
        // Preparar dados das frequências
        const frequencias: IFrequencia[] = registros.map((registro: any) => ({
            aluno_id: registro.aluno_id,
            disciplina_id: disciplina_id,
            data_aula: new Date(data_aula),
            status: registro.status,
            justificativa: registro.justificativa,
            professor_id: professorId
        }));
        
        // Registrar frequências em massa
        const sucesso = await Frequencia.registrarEmMassa(frequencias);
        
        if (!sucesso) {
            throw new Error('Falha ao registrar frequências');
        }
        
        // Calcular estatísticas
        let total = frequencias.length;
        let presentes = frequencias.filter(f => f.status === 'presente').length;
        let faltas = frequencias.filter(f => f.status === 'falta').length;
        let justificadas = frequencias.filter(f => f.status === 'justificado').length;
        let atrasos = frequencias.filter(f => f.status === 'atraso').length;
        
        const percentagemPresenca = total > 0 ? ((presentes + atrasos) / total) * 100 : 0;
        
        res.json({
            mensagem: 'Frequências registradas com sucesso',
            estatisticas: {
                total,
                presentes,
                faltas,
                justificadas,
                atrasos,
                percentagem_presenca: percentagemPresenca
            }
        });
        
    } catch (error) {
        console.error('Erro ao registrar frequências:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter materiais didáticos do professor
router.get('/materiais', async (req: any, res) => {
    try {
        const professorId = req.usuario.id;
        
        const [materiaisRows] = await pool.query(
            `SELECT b.*, d.nome as disciplina_nome
             FROM biblioteca b
             LEFT JOIN disciplinas d ON b.disciplina_id = d.id
             WHERE b.uploader_id = ?
             AND b.ativo = TRUE
             ORDER BY b.data_upload DESC`,
            [professorId]
        );
        
        // Obter disciplinas lecionadas
        const [disciplinasRows] = await pool.query(
            'SELECT id, nome FROM disciplinas WHERE professor_id = ?',
            [professorId]
        );
        
        res.json({
            materiais: materiaisRows,
            disciplinas: disciplinasRows
        });
        
    } catch (error) {
        console.error('Erro ao obter materiais:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para adicionar material didático
router.post('/materiais', [
    body('titulo').notEmpty().withMessage('Título é obrigatório'),
    body('tipo').isIn(['livro', 'artigo', 'video', 'apostila', 'software']).withMessage('Tipo inválido'),
    body('categoria').notEmpty().withMessage('Categoria é obrigatória'),
    body('curso').notEmpty().withMessage('Curso é obrigatório'),
    body('arquivo_url').notEmpty().withMessage('URL do arquivo é obrigatória')
], async (req: any, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ erros: errors.array() });
    }
    
    try {
        const professorId = req.usuario.id;
        
        const materialData = {
            ...req.body,
            uploader_id: professorId,
            ativo: true,
            data_upload: new Date()
        };
        
        const Biblioteca = require('../models/Biblioteca').Biblioteca;
        const material = await Biblioteca.adicionar(materialData);
        
        res.status(201).json({
            mensagem: 'Material adicionado com sucesso',
            material
        });
        
    } catch (error) {
        console.error('Erro ao adicionar material:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter relatórios da turma
router.get('/relatorios/turma/:turmaId', async (req: any, res) => {
    try {
        const professorId = req.usuario.id;
        const turmaId = req.params.turmaId;
        
        // Verificar se professor é responsável pela turma
        const [turmaRows] = await pool.query(
            'SELECT id, nome FROM turmas WHERE id = ? AND professor_responsavel = ?',
            [turmaId, professorId]
        );
        
        if ((turmaRows as any[]).length === 0) {
            return res.status(403).json({ erro: 'Acesso não autorizado a esta turma' });
        }
        
        // Obter estatísticas da turma
        const [estatisticasRows] = await pool.query(
            `SELECT 
                COUNT(DISTINCT u.id) as total_alunos,
                AVG((SELECT AVG(valor) FROM notas n JOIN matriculas m ON n.disciplina_id = m.disciplina_id WHERE n.aluno_id = u.id AND m.turma_id = ?)) as media_geral_turma,
                (SELECT COUNT(*) FROM frequencias f JOIN usuarios u2 ON f.aluno_id = u2.id WHERE u2.turma_id = ? AND f.status IN ('presente', 'atraso')) * 100.0 / 
                NULLIF((SELECT COUNT(*) FROM frequencias f2 JOIN usuarios u3 ON f2.aluno_id = u3.id WHERE u3.turma_id = ?), 0) as percentagem_presenca_turma
             FROM usuarios u
             WHERE u.turma_id = ? AND u.tipo = 'aluno'`,
            [turmaId, turmaId, turmaId, turmaId]
        );
        
        // Obter top 5 alunos
        const [topAlunosRows] = await pool.query(
            `SELECT u.id, u.nome_completo,
                    (SELECT AVG(valor) FROM notas WHERE aluno_id = u.id) as media_geral
             FROM usuarios u
             WHERE u.turma_id = ? AND u.tipo = 'aluno'
             ORDER BY media_geral DESC
             LIMIT 5`,
            [turmaId]
        );
        
        // Obter disciplinas com menores médias
        const [disciplinasRows] = await pool.query(
            `SELECT d.nome,
                    AVG(n.valor) as media_disciplina,
                    COUNT(DISTINCT n.aluno_id) as total_alunos_avaliados
             FROM disciplinas d
             JOIN notas n ON d.id = n.disciplina_id
             JOIN usuarios u ON n.aluno_id = u.id
             WHERE u.turma_id = ?
             GROUP BY d.id
             ORDER BY media_disciplina ASC
             LIMIT 5`,
            [turmaId]
        );
        
        res.json({
            turma: turmaRows[0],
            estatisticas: estatisticasRows[0],
            top_alunos: topAlunosRows,
            disciplinas_baixo_desempenho: disciplinasRows
        });
        
    } catch (error) {
        console.error('Erro ao obter relatório:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

export default router;