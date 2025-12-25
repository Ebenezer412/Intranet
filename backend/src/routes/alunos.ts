import express from 'express';
import { autenticar } from './auth';
import { Nota } from '../models/Nota';
import { Frequencia } from '../models/Frequencia';
import { Usuario } from '../models/Usuario';
import pool from '../database/connection';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(autenticar);

// Rota para obter dashboard do aluno
router.get('/dashboard', async (req: any, res) => {
    try {
        const alunoId = req.usuario.id;
        
        // Obter informações do aluno
        const [alunoRows] = await pool.query(
            `SELECT u.*, t.nome as turma_nome 
             FROM usuarios u 
             LEFT JOIN turmas t ON u.turma_id = t.id 
             WHERE u.id = ?`,
            [alunoId]
        );
        
        const aluno = (alunoRows as any[])[0];
        
        if (!aluno) {
            return res.status(404).json({ erro: 'Aluno não encontrado' });
        }
        
        // Obter disciplinas do aluno
        const [disciplinasRows] = await pool.query(
            `SELECT d.*, 
                    (SELECT COUNT(*) FROM notas WHERE aluno_id = ? AND disciplina_id = d.id) as total_notas,
                    (SELECT AVG(valor) FROM notas WHERE aluno_id = ? AND disciplina_id = d.id) as media_geral
             FROM disciplinas d
             JOIN matriculas m ON d.id = m.disciplina_id
             WHERE m.aluno_id = ? AND m.status = 'matriculado'`,
            [alunoId, alunoId, alunoId]
        );
        
        // Obter últimas notas
        const [notasRows] = await pool.query(
            `SELECT n.*, d.nome as disciplina_nome, 
                    u.nome_completo as professor_nome
             FROM notas n
             JOIN disciplinas d ON n.disciplina_id = d.id
             JOIN usuarios u ON n.professor_id = u.id
             WHERE n.aluno_id = ?
             ORDER BY n.data_avaliacao DESC
             LIMIT 5`,
            [alunoId]
        );
        
        // Obter próximos eventos
        const [eventosRows] = await pool.query(
            `SELECT * FROM eventos 
             WHERE publico_alvo IN ('todos', 'alunos')
             AND data_inicio >= CURDATE()
             ORDER BY data_inicio ASC
             LIMIT 5`
        );
        
        // Calcular estatísticas
        const [estatisticasRows] = await pool.query(
            `SELECT 
                COUNT(DISTINCT disciplina_id) as total_disciplinas,
                AVG((SELECT AVG(valor) FROM notas WHERE aluno_id = ? AND disciplina_id = m.disciplina_id)) as media_geral
             FROM matriculas m
             WHERE m.aluno_id = ? AND m.status = 'matriculado'`,
            [alunoId, alunoId]
        );
        
        // Obter frequência do mês atual
        const mesAtual = new Date().getMonth() + 1;
        const anoAtual = new Date().getFullYear();
        
        const [frequenciaRows] = await pool.query(
            `SELECT 
                COUNT(*) as total_aulas,
                SUM(CASE WHEN status IN ('presente', 'atraso') THEN 1 ELSE 0 END) as presencas
             FROM frequencias 
             WHERE aluno_id = ? 
             AND MONTH(data_aula) = ? 
             AND YEAR(data_aula) = ?`,
            [alunoId, mesAtual, anoAtual]
        );
        
        const frequencia = (frequenciaRows as any[])[0];
        const percentagemPresenca = frequencia.total_aulas > 0 
            ? (frequencia.presencas / frequencia.total_aulas) * 100 
            : 0;
        
        res.json({
            aluno,
            estatisticas: {
                total_disciplinas: estatisticasRows[0]?.total_disciplinas || 0,
                media_geral: estatisticasRows[0]?.media_geral || 0,
                percentagem_presenca: percentagemPresenca,
                total_notas: notasRows.length
            },
            disciplinas: disciplinasRows,
            ultimas_notas: notasRows,
            proximos_eventos: eventosRows
        });
        
    } catch (error) {
        console.error('Erro ao obter dashboard:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter notas do aluno
router.get('/notas', async (req: any, res) => {
    try {
        const alunoId = req.usuario.id;
        const { disciplina_id } = req.query;
        
        const notas = await Nota.buscarPorAluno(
            alunoId, 
            disciplina_id ? parseInt(disciplina_id as string) : undefined
        );
        
        // Calcular médias por disciplina
        const disciplinasMap = new Map();
        
        for (const nota of notas) {
            if (!disciplinasMap.has(nota.disciplina_id)) {
                const media = await Nota.calcularMedia(alunoId, nota.disciplina_id);
                disciplinasMap.set(nota.disciplina_id, {
                    disciplina_id: nota.disciplina_id,
                    disciplina_nome: (nota as any).disciplina_nome,
                    media: media,
                    notas: []
                });
            }
            
            disciplinasMap.get(nota.disciplina_id).notas.push(nota);
        }
        
        const notasPorDisciplina = Array.from(disciplinasMap.values());
        
        res.json({
            notas: notas,
            notas_por_disciplina: notasPorDisciplina
        });
        
    } catch (error) {
        console.error('Erro ao obter notas:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter frequências do aluno
router.get('/frequencias', async (req: any, res) => {
    try {
        const alunoId = req.usuario.id;
        const { mes, ano } = req.query;
        
        const mesNum = mes ? parseInt(mes as string) : new Date().getMonth() + 1;
        const anoNum = ano ? parseInt(ano as string) : new Date().getFullYear();
        
        const frequencias = await Frequencia.buscarPorAluno(alunoId, mesNum, anoNum);
        
        // Calcular estatísticas
        let total = 0;
        let presentes = 0;
        let faltas = 0;
        let justificadas = 0;
        let atrasos = 0;
        
        for (const freq of frequencias) {
            total++;
            switch (freq.status) {
                case 'presente': presentes++; break;
                case 'falta': faltas++; break;
                case 'justificado': justificadas++; break;
                case 'atraso': atrasos++; break;
            }
        }
        
        const percentagemPresenca = total > 0 ? ((presentes + atrasos) / total) * 100 : 0;
        
        res.json({
            frequencias,
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
        console.error('Erro ao obter frequências:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter horário do aluno
router.get('/horario', async (req: any, res) => {
    try {
        const alunoId = req.usuario.id;
        
        // Obter turma do aluno
        const [alunoRows] = await pool.query(
            'SELECT turma_id FROM usuarios WHERE id = ?',
            [alunoId]
        );
        
        const aluno = (alunoRows as any[])[0];
        
        if (!aluno || !aluno.turma_id) {
            return res.status(404).json({ erro: 'Turma não encontrada para este aluno' });
        }
        
        // Obter horário da turma
        const [turmaRows] = await pool.query(
            'SELECT horario FROM turmas WHERE id = ?',
            [aluno.turma_id]
        );
        
        const turma = (turmaRows as any[])[0];
        
        // Parse do horário (assumindo formato JSON)
        let horario = [];
        if (turma.horario) {
            try {
                horario = JSON.parse(turma.horario);
            } catch (e) {
                console.error('Erro ao parsear horário:', e);
            }
        }
        
        res.json({
            turma_id: aluno.turma_id,
            horario: horario
        });
        
    } catch (error) {
        console.error('Erro ao obter horário:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter documentos do aluno
router.get('/documentos', async (req: any, res) => {
    try {
        const alunoId = req.usuario.id;
        
        // Obter turma e curso do aluno
        const [alunoRows] = await pool.query(
            `SELECT u.turma_id, t.curso 
             FROM usuarios u 
             JOIN turmas t ON u.turma_id = t.id 
             WHERE u.id = ?`,
            [alunoId]
        );
        
        const aluno = (alunoRows as any[])[0];
        
        if (!aluno) {
            return res.status(404).json({ erro: 'Aluno não encontrado' });
        }
        
        // Obter documentos relacionados ao curso do aluno
        const [documentosRows] = await pool.query(
            `SELECT b.*, d.nome as disciplina_nome,
                    u.nome_completo as uploader_nome
             FROM biblioteca b
             LEFT JOIN disciplinas d ON b.disciplina_id = d.id
             LEFT JOIN usuarios u ON b.uploader_id = u.id
             WHERE b.curso = ? OR b.curso = 'Geral'
             AND b.ativo = TRUE
             ORDER BY b.data_upload DESC`,
            [aluno.curso]
        );
        
        // Obter boletins do aluno (notas consolidadas)
        const [boletinsRows] = await pool.query(
            `SELECT 
                DATE_FORMAT(n.data_avaliacao, '%Y-%m') as mes,
                d.nome as disciplina_nome,
                AVG(n.valor) as media_mensal,
                COUNT(*) as total_avaliacoes
             FROM notas n
             JOIN disciplinas d ON n.disciplina_id = d.id
             WHERE n.aluno_id = ?
             GROUP BY DATE_FORMAT(n.data_avaliacao, '%Y-%m'), n.disciplina_id
             ORDER BY mes DESC`,
            [alunoId]
        );
        
        res.json({
            documentos: documentosRows,
            boletins: boletinsRows
        });
        
    } catch (error) {
        console.error('Erro ao obter documentos:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para obter mensagens do aluno
router.get('/mensagens', async (req: any, res) => {
    try {
        const alunoId = req.usuario.id;
        const { nao_lidas } = req.query;
        
        let query = `
            SELECT m.*, 
                   u1.nome_completo as remetente_nome,
                   u1.tipo as remetente_tipo,
                   u2.nome_completo as destinatario_nome
            FROM mensagens m
            JOIN usuarios u1 ON m.remetente_id = u1.id
            JOIN usuarios u2 ON m.destinatario_id = u2.id
            WHERE m.destinatario_id = ?
        `;
        
        const params: any[] = [alunoId];
        
        if (nao_lidas === 'true') {
            query += ' AND m.lida = FALSE';
        }
        
        query += ' ORDER BY m.data_envio DESC';
        
        const [mensagensRows] = await pool.query(query, params);
        
        // Contar mensagens não lidas
        const [naoLidasRows] = await pool.query(
            'SELECT COUNT(*) as total FROM mensagens WHERE destinatario_id = ? AND lida = FALSE',
            [alunoId]
        );
        
        res.json({
            mensagens: mensagensRows,
            total_nao_lidas: naoLidasRows[0]?.total || 0
        });
        
    } catch (error) {
        console.error('Erro ao obter mensagens:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para enviar mensagem
router.post('/mensagens', async (req: any, res) => {
    try {
        const { destinatario_id, assunto, conteudo } = req.body;
        const remetenteId = req.usuario.id;
        
        if (!destinatario_id || !conteudo) {
            return res.status(400).json({ erro: 'Destinatário e conteúdo são obrigatórios' });
        }
        
        // Verificar se destinatário existe
        const [destinatarioRows] = await pool.query(
            'SELECT id, tipo FROM usuarios WHERE id = ?',
            [destinatario_id]
        );
        
        if ((destinatarioRows as any[]).length === 0) {
            return res.status(404).json({ erro: 'Destinatário não encontrado' });
        }
        
        // Inserir mensagem
        const [result] = await pool.query(
            'INSERT INTO mensagens (remetente_id, destinatario_id, assunto, conteudo) VALUES (?, ?, ?, ?)',
            [remetenteId, destinatario_id, assunto, conteudo]
        );
        
        const mensagemId = (result as any).insertId;
        
        // Buscar mensagem inserida
        const [mensagemRows] = await pool.query(
            `SELECT m.*, 
                    u1.nome_completo as remetente_nome,
                    u2.nome_completo as destinatario_nome
             FROM mensagens m
             JOIN usuarios u1 ON m.remetente_id = u1.id
             JOIN usuarios u2 ON m.destinatario_id = u2.id
             WHERE m.id = ?`,
            [mensagemId]
        );
        
        res.status(201).json({
            mensagem: 'Mensagem enviada com sucesso',
            dados: mensagemRows[0]
        });
        
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

// Rota para marcar mensagem como lida
router.put('/mensagens/:id/ler', async (req: any, res) => {
    try {
        const mensagemId = req.params.id;
        const alunoId = req.usuario.id;
        
        // Verificar se mensagem pertence ao aluno
        const [mensagemRows] = await pool.query(
            'SELECT id FROM mensagens WHERE id = ? AND destinatario_id = ?',
            [mensagemId, alunoId]
        );
        
        if ((mensagemRows as any[]).length === 0) {
            return res.status(404).json({ erro: 'Mensagem não encontrada' });
        }
        
        // Marcar como lida
        await pool.query(
            'UPDATE mensagens SET lida = TRUE WHERE id = ?',
            [mensagemId]
        );
        
        res.json({ mensagem: 'Mensagem marcada como lida' });
        
    } catch (error) {
        console.error('Erro ao marcar mensagem como lida:', error);
        res.status(500).json({ erro: 'Erro interno do servidor' });
    }
});

export default router;