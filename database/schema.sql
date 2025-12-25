-- Criar base de dados
CREATE DATABASE IF NOT EXISTS imel_intranet;
USE imel_intranet;

-- Tabela de Usuários
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_processo VARCHAR(20) UNIQUE,
    nome_completo VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    senha_hash VARCHAR(255),
    tipo ENUM('aluno', 'professor', 'admin', 'diretor', 'coordenador', 'encarregado') NOT NULL,
    avatar VARCHAR(10),
    turma_id INT,
    departamento VARCHAR(50),
    cargo VARCHAR(50),
    telefone VARCHAR(20),
    data_nascimento DATE,
    endereco TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acesso TIMESTAMP NULL,
    FOREIGN KEY (turma_id) REFERENCES turmas(id)
);

-- Tabela de Turmas
CREATE TABLE turmas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(50) NOT NULL,
    curso VARCHAR(100) NOT NULL,
    ano_letivo VARCHAR(20),
    sala VARCHAR(20),
    professor_responsavel INT,
    horario TEXT,
    FOREIGN KEY (professor_responsavel) REFERENCES usuarios(id)
);

-- Tabela de Disciplinas (Curso de Informática de Gestão - Angola)
CREATE TABLE disciplinas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    codigo VARCHAR(20),
    curso VARCHAR(100),
    ano INT,
    semestre INT,
    carga_horaria INT,
    professor_id INT,
    FOREIGN KEY (professor_id) REFERENCES usuarios(id)
);

-- Tabela de Matrículas (Aluno x Disciplina)
CREATE TABLE matriculas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    aluno_id INT NOT NULL,
    disciplina_id INT NOT NULL,
    turma_id INT NOT NULL,
    ano_letivo VARCHAR(20),
    status ENUM('matriculado', 'trancado', 'concluído') DEFAULT 'matriculado',
    FOREIGN KEY (aluno_id) REFERENCES usuarios(id),
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
    FOREIGN KEY (turma_id) REFERENCES turmas(id),
    UNIQUE KEY unique_matricula (aluno_id, disciplina_id, ano_letivo)
);

-- Tabela de Notas
CREATE TABLE notas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    aluno_id INT NOT NULL,
    disciplina_id INT NOT NULL,
    tipo_avaliacao ENUM('teste1', 'teste2', 'projeto', 'participacao', 'exame') NOT NULL,
    valor DECIMAL(4,2) CHECK (valor >= 0 AND valor <= 20),
    peso DECIMAL(3,2) DEFAULT 1.0,
    data_avaliacao DATE,
    professor_id INT,
    observacoes TEXT,
    FOREIGN KEY (aluno_id) REFERENCES usuarios(id),
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
    FOREIGN KEY (professor_id) REFERENCES usuarios(id)
);

-- Tabela de Frequências
CREATE TABLE frequencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    aluno_id INT NOT NULL,
    disciplina_id INT NOT NULL,
    data_aula DATE NOT NULL,
    status ENUM('presente', 'falta', 'justificado', 'atraso') DEFAULT 'presente',
    justificativa TEXT,
    professor_id INT,
    FOREIGN KEY (aluno_id) REFERENCES usuarios(id),
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
    FOREIGN KEY (professor_id) REFERENCES usuarios(id)
);

-- Tabela de Mensagens
CREATE TABLE mensagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    remetente_id INT NOT NULL,
    destinatario_id INT NOT NULL,
    assunto VARCHAR(200),
    conteudo TEXT NOT NULL,
    lida BOOLEAN DEFAULT FALSE,
    data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (remetente_id) REFERENCES usuarios(id),
    FOREIGN KEY (destinatario_id) REFERENCES usuarios(id)
);

-- Tabela de Biblioteca Virtual
CREATE TABLE biblioteca (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    autor VARCHAR(100),
    tipo ENUM('livro', 'artigo', 'video', 'apostila', 'software') NOT NULL,
    categoria VARCHAR(100),
    curso VARCHAR(100),
    disciplina_id INT,
    arquivo_url VARCHAR(500),
    descricao TEXT,
    tamanho VARCHAR(20),
    formato VARCHAR(20),
    downloads INT DEFAULT 0,
    uploader_id INT,
    data_upload TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ativo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (disciplina_id) REFERENCES disciplinas(id),
    FOREIGN KEY (uploader_id) REFERENCES usuarios(id)
);

-- Tabela de Papelaria Virtual
CREATE TABLE papelaria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_produto VARCHAR(200) NOT NULL,
    descricao TEXT,
    categoria VARCHAR(100),
    preco DECIMAL(10,2) NOT NULL,
    quantidade INT DEFAULT 0,
    imagem_url VARCHAR(500),
    fornecedor VARCHAR(100),
    codigo_barras VARCHAR(50),
    data_entrada DATE,
    ativo BOOLEAN DEFAULT TRUE
);

-- Tabela de Pedidos Papelaria
CREATE TABLE pedidos_papelaria (
    id INT AUTO_INCREMENT PRIMARY KEY,
    aluno_id INT NOT NULL,
    produto_id INT NOT NULL,
    quantidade INT NOT NULL,
    valor_total DECIMAL(10,2),
    status ENUM('pendente', 'processando', 'entregue', 'cancelado') DEFAULT 'pendente',
    data_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_entrega DATE,
    observacoes TEXT,
    FOREIGN KEY (aluno_id) REFERENCES usuarios(id),
    FOREIGN KEY (produto_id) REFERENCES papelaria(id)
);

-- Tabela de Eventos (Calendário)
CREATE TABLE eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descricao TEXT,
    tipo ENUM('academico', 'administrativo', 'cultural', 'esportivo', 'reuniao') NOT NULL,
    data_inicio DATETIME NOT NULL,
    data_fim DATETIME,
    local VARCHAR(200),
    organizador_id INT,
    publico_alvo ENUM('todos', 'alunos', 'professores', 'admin', 'encarregados'),
    cor VARCHAR(20),
    FOREIGN KEY (organizador_id) REFERENCES usuarios(id)
);

-- Tabela de Configurações do Sistema
CREATE TABLE config_sistema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descricao VARCHAR(200),
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_alunos_turma ON usuarios(turma_id) WHERE tipo = 'aluno';
CREATE INDEX idx_notas_aluno ON notas(aluno_id, disciplina_id);
CREATE INDEX idx_frequencia_data ON frequencias(data_aula, aluno_id);
CREATE INDEX idx_mensagens_destinatario ON mensagens(destinatario_id, lida);
CREATE INDEX idx_biblioteca_curso ON biblioteca(curso, disciplina_id);
CREATE INDEX idx_papelaria_categoria ON papelaria(categoria, ativo);