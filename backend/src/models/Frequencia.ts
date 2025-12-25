import pool from '../database/connection';

export interface IFrequencia {
    id?: number;
    aluno_id: number;
    disciplina_id: number;
    data_aula: Date;
    status: 'presente' | 'falta' | 'justificado' | 'atraso';
    justificativa?: string;
    professor_id: number;
}

export class Frequencia {
    // Registrar frequência
    static async registrar(frequencia: IFrequencia): Promise<IFrequencia> {
        const [result] = await pool.query(
            'INSERT INTO frequencias SET ?',
            [frequencia]
        );
        
        const insertedId = (result as any).insertId;
        return await this.buscarPorId(insertedId);
    }
    
    // Registrar frequências em massa
    static async registrarEmMassa(frequencias: IFrequencia[]): Promise<boolean> {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            for (const frequencia of frequencias) {
                // Verificar se já existe registro para este aluno nesta data
                const [existing] = await connection.query(
                    `SELECT id FROM frequencias 
                     WHERE aluno_id = ? 
                     AND disciplina_id = ?
                     AND data_aula = ?`,
                    [frequencia.aluno_id, frequencia.disciplina_id, frequencia.data_aula]
                );
                
                if (Array.isArray(existing) && existing.length > 0) {
                    // Atualizar registro existente
                    await connection.query(
                        'UPDATE frequencias SET status = ?, justificativa = ? WHERE id = ?',
                        [frequencia.status, frequencia.justificativa, (existing[0] as any).id]
                    );
                } else {
                    // Inserir novo registro
                    await connection.query(
                        'INSERT INTO frequencias SET ?',
                        [frequencia]
                    );
                }
            }
            
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    
    // Buscar por ID
    static async buscarPorId(id: number): Promise<IFrequencia | null> {
        const [rows] = await pool.query(
            'SELECT * FROM frequencias WHERE id = ?',
            [id]
        );
        
        if (Array.isArray(rows) && rows.length > 0) {
            return rows[0] as IFrequencia;
        }
        return null;
    }
    
    // Buscar frequências do aluno
    static async buscarPorAluno(alunoId: number, mes?: number, ano?: number): Promise<IFrequencia[]> {
        let query = `
            SELECT f.*, d.nome as disciplina_nome,
                   u.nome_completo as professor_nome
            FROM frequencias f
            JOIN disciplinas d ON f.disciplina_id = d.id
            JOIN usuarios u ON f.professor_id = u.id
            WHERE f.aluno_id = ?
        `;
        
        const params: any[] = [alunoId];
        
        if (mes && ano) {
            query += ' AND MONTH(f.data_aula) = ? AND YEAR(f.data_aula) = ?';
            params.push(mes, ano);
        }
        
        query += ' ORDER BY f.data_aula DESC';
        
        const [rows] = await pool.query(query, params);
        return rows as IFrequencia[];
    }
    
    // Calcular percentagem de presença
    static async calcularPresenca(alunoId: number, disciplinaId: number): Promise<{total: number, presentes: number, percentagem: number}> {
        const [rows] = await pool.query(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status IN ('presente', 'atraso') THEN 1 ELSE 0 END) as presentes
            FROM frequencias 
            WHERE aluno_id = ? AND disciplina_id = ?`,
            [alunoId, disciplinaId]
        );
        
        const result = rows as any;
        const total = result[0]?.total || 0;
        const presentes = result[0]?.presentes || 0;
        const percentagem = total > 0 ? (presentes / total) * 100 : 0;
        
        return { total, presentes, percentagem };
    }
    
    // Atualizar frequência
    static async atualizar(id: number, dados: Partial<IFrequencia>): Promise<boolean> {
        const [result] = await pool.query(
            'UPDATE frequencias SET ? WHERE id = ?',
            [dados, id]
        );
        
        return (result as any).affectedRows > 0;
    }
}