import pool from '../database/connection';
import bcrypt from 'bcryptjs';

export interface IUsuario {
    id?: number;
    numero_processo: string;
    nome_completo: string;
    email: string;
    senha_hash?: string;
    tipo: 'aluno' | 'professor' | 'admin' | 'diretor' | 'coordenador' | 'encarregado';
    avatar?: string;
    turma_id?: number;
    departamento?: string;
    cargo?: string;
    telefone?: string;
    data_nascimento?: Date;
    endereco?: string;
    ativo?: boolean;
    data_criacao?: Date;
    ultimo_acesso?: Date;
}

export class Usuario {
    // Criar novo usuário
    static async criar(usuario: IUsuario): Promise<IUsuario> {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            // Verificar se número de processo já existe
            const [existing] = await connection.query(
                'SELECT id FROM usuarios WHERE numero_processo = ?',
                [usuario.numero_processo]
            );
            
            if (Array.isArray(existing) && existing.length > 0) {
                throw new Error('Número de processo já existe');
            }
            
            // Gerar avatar se não fornecido
            if (!usuario.avatar) {
                usuario.avatar = usuario.nome_completo
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2);
            }
            
            const [result] = await connection.query(
                `INSERT INTO usuarios SET ?`,
                [usuario]
            );
            
            await connection.commit();
            
            const insertedId = (result as any).insertId;
            const novoUsuario = await this.buscarPorId(insertedId);
            
            return novoUsuario;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    
    // Buscar usuário por ID
    static async buscarPorId(id: number): Promise<IUsuario | null> {
        const [rows] = await pool.query(
            'SELECT * FROM usuarios WHERE id = ?',
            [id]
        );
        
        if (Array.isArray(rows) && rows.length > 0) {
            return rows[0] as IUsuario;
        }
        return null;
    }
    
    // Buscar por número de processo
    static async buscarPorNumeroProcesso(numeroProcesso: string): Promise<IUsuario | null> {
        const [rows] = await pool.query(
            'SELECT * FROM usuarios WHERE numero_processo = ?',
            [numeroProcesso]
        );
        
        if (Array.isArray(rows) && rows.length > 0) {
            return rows[0] as IUsuario;
        }
        return null;
    }
    
    // Atualizar senha
    static async atualizarSenha(id: number, novaSenha: string): Promise<boolean> {
        const senhaHash = await bcrypt.hash(novaSenha, 10);
        
        const [result] = await pool.query(
            'UPDATE usuarios SET senha_hash = ? WHERE id = ?',
            [senhaHash, id]
        );
        
        return (result as any).affectedRows > 0;
    }
    
    // Verificar credenciais
    static async verificarCredenciais(numeroProcesso: string, senha: string): Promise<IUsuario | null> {
        const usuario = await this.buscarPorNumeroProcesso(numeroProcesso);
        
        if (!usuario || !usuario.senha_hash) {
            return null;
        }
        
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        
        if (!senhaValida) {
            return null;
        }
        
        // Atualizar último acesso
        await pool.query(
            'UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?',
            [usuario.id]
        );
        
        // Remover senha_hash do objeto retornado
        delete usuario.senha_hash;
        
        return usuario;
    }
    
    // Atualizar informações do usuário
    static async atualizar(id: number, dados: Partial<IUsuario>): Promise<boolean> {
        const [result] = await pool.query(
            'UPDATE usuarios SET ? WHERE id = ?',
            [dados, id]
        );
        
        return (result as any).affectedRows > 0;
    }
    
    // Listar usuários por tipo
    static async listarPorTipo(tipo: string, pagina = 1, limite = 20): Promise<{usuarios: IUsuario[], total: number}> {
        const offset = (pagina - 1) * limite;
        
        const [rows] = await pool.query(
            'SELECT * FROM usuarios WHERE tipo = ? LIMIT ? OFFSET ?',
            [tipo, limite, offset]
        );
        
        const [totalRows] = await pool.query(
            'SELECT COUNT(*) as total FROM usuarios WHERE tipo = ?',
            [tipo]
        );
        
        const total = (totalRows as any)[0].total;
        
        return {
            usuarios: rows as IUsuario[],
            total
        };
    }
}