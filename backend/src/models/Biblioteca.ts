import pool from '../database/connection';

export interface IItemBiblioteca {
    id?: number;
    titulo: string;
    autor?: string;
    tipo: 'livro' | 'artigo' | 'video' | 'apostila' | 'software';
    categoria: string;
    curso: string;
    disciplina_id?: number;
    arquivo_url: string;
    descricao?: string;
    tamanho?: string;
    formato?: string;
    downloads: number;
    uploader_id?: number;
    data_upload?: Date;
    ativo: boolean;
}

export class Biblioteca {
    // Adicionar item
    static async adicionar(item: IItemBiblioteca): Promise<IItemBiblioteca> {
        const [result] = await pool.query(
            'INSERT INTO biblioteca SET ?',
            [item]
        );
        
        const insertedId = (result as any).insertId;
        return await this.buscarPorId(insertedId);
    }
    
    // Buscar por ID
    static async buscarPorId(id: number): Promise<IItemBiblioteca | null> {
        const [rows] = await pool.query(
            `SELECT b.*, d.nome as disciplina_nome,
                   u.nome_completo as uploader_nome
            FROM biblioteca b
            LEFT JOIN disciplinas d ON b.disciplina_id = d.id
            LEFT JOIN usuarios u ON b.uploader_id = u.id
            WHERE b.id = ?`,
            [id]
        );
        
        if (Array.isArray(rows) && rows.length > 0) {
            return rows[0] as IItemBiblioteca;
        }
        return null;
    }
    
    // Listar itens
    static async listar(filtros: {
        curso?: string;
        disciplina_id?: number;
        tipo?: string;
        categoria?: string;
        search?: string;
    }, pagina = 1, limite = 20): Promise<{itens: IItemBiblioteca[], total: number}> {
        let query = `
            SELECT b.*, d.nome as disciplina_nome,
                   u.nome_completo as uploader_nome
            FROM biblioteca b
            LEFT JOIN disciplinas d ON b.disciplina_id = d.id
            LEFT JOIN usuarios u ON b.uploader_id = u.id
            WHERE b.ativo = TRUE
        `;
        
        const params: any[] = [];
        
        if (filtros.curso) {
            query += ' AND b.curso = ?';
            params.push(filtros.curso);
        }
        
        if (filtros.disciplina_id) {
            query += ' AND b.disciplina_id = ?';
            params.push(filtros.disciplina_id);
        }
        
        if (filtros.tipo) {
            query += ' AND b.tipo = ?';
            params.push(filtros.tipo);
        }
        
        if (filtros.categoria) {
            query += ' AND b.categoria = ?';
            params.push(filtros.categoria);
        }
        
        if (filtros.search) {
            query += ' AND (b.titulo LIKE ? OR b.descricao LIKE ? OR b.autor LIKE ?)';
            const searchTerm = `%${filtros.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        const offset = (pagina - 1) * limite;
        query += ' ORDER BY b.data_upload DESC LIMIT ? OFFSET ?';
        params.push(limite, offset);
        
        const [rows] = await pool.query(query, params);
        
        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM biblioteca WHERE ativo = TRUE';
        const countParams: any[] = [];
        
        if (filtros.curso) {
            countQuery += ' AND curso = ?';
            countParams.push(filtros.curso);
        }
        
        if (filtros.disciplina_id) {
            countQuery += ' AND disciplina_id = ?';
            countParams.push(filtros.disciplina_id);
        }
        
        const [totalRows] = await pool.query(countQuery, countParams);
        const total = (totalRows as any)[0].total;
        
        return {
            itens: rows as IItemBiblioteca[],
            total
        };
    }
    
    // Incrementar downloads
    static async incrementarDownloads(id: number): Promise<boolean> {
        const [result] = await pool.query(
            'UPDATE biblioteca SET downloads = downloads + 1 WHERE id = ?',
            [id]
        );
        
        return (result as any).affectedRows > 0;
    }
    
    // Atualizar item
    static async atualizar(id: number, dados: Partial<IItemBiblioteca>): Promise<boolean> {
        const [result] = await pool.query(
            'UPDATE biblioteca SET ? WHERE id = ?',
            [dados, id]
        );
        
        return (result as any).affectedRows > 0;
    }
    
    // Eliminar item (soft delete)
    static async eliminar(id: number): Promise<boolean> {
        const [result] = await pool.query(
            'UPDATE biblioteca SET ativo = FALSE WHERE id = ?',
            [id]
        );
        
        return (result as any).affectedRows > 0;
    }
}