import pool from '../database/connection';

export interface INota {
    id?: number;
    aluno_id: number;
    disciplina_id: number;
    tipo_avaliacao: 'teste1' | 'teste2' | 'projeto' | 'participacao' | 'exame';
    valor: number;
    peso: number;
    data_avaliacao: Date;
    professor_id: number;
    observacoes?: string;
}

export class Nota {
    // Inserir nota
    static async inserir(nota: INota): Promise<INota> {
        const [result] = await pool.query(
            'INSERT INTO notas SET ?',
            [nota]
        );
        
        const insertedId = (result as any).insertId;
        return await this.buscarPorId(insertedId);
    }
    
    // Buscar nota por ID
    static async buscarPorId(id: number): Promise<INota | null> {
        const [rows] = await pool.query(
            'SELECT * FROM notas WHERE id = ?',
            [id]
        );
        
        if (Array.isArray(rows) && rows.length > 0) {
            return rows[0] as INota;
        }
        return null;
    }
    
    // Buscar notas do aluno
    static async buscarPorAluno(alunoId: number, disciplinaId?: number): Promise<INota[]> {
        let query = `
            SELECT n.*, d.nome as disciplina_nome, 
                   u.nome_completo as professor_nome 
            FROM notas n
            JOIN disciplinas d ON n.disciplina_id = d.id
            JOIN usuarios u ON n.professor_id = u.id
            WHERE n.aluno_id = ?
        `;
        
        const params: any[] = [alunoId];
        
        if (disciplinaId) {
            query += ' AND n.disciplina_id = ?';
            params.push(disciplinaId);
        }
        
        query += ' ORDER BY n.data_avaliacao DESC';
        
        const [rows] = await pool.query(query, params);
        return rows as INota[];
    }
    
    // Calcular média do aluno
    static async calcularMedia(alunoId: number, disciplinaId: number): Promise<number> {
        const [rows] = await pool.query(
            `SELECT 
                SUM(valor * peso) / SUM(peso) as media
            FROM notas 
            WHERE aluno_id = ? AND disciplina_id = ?`,
            [alunoId, disciplinaId]
        );
        
        const result = rows as any;
        return result[0]?.media || 0;
    }
    
    // Atualizar nota
    static async atualizar(id: number, dados: Partial<INota>): Promise<boolean> {
        const [result] = await pool.query(
            'UPDATE notas SET ? WHERE id = ?',
            [dados, id]
        );
        
        return (result as any).affectedRows > 0;
    }
    
    // Eliminar nota
    static async eliminar(id: number): Promise<boolean> {
        const [result] = await pool.query(
            'DELETE FROM notas WHERE id = ?',
            [id]
        );
        
        return (result as any).affectedRows > 0;
    }
}