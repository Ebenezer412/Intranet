-- Inserir disciplinas do curso de Informática de Gestão (Angola)
INSERT INTO disciplinas (nome, codigo, curso, ano, semestre, carga_horaria) VALUES
-- 1º Ano
('Introdução à Informática', 'INF101', 'Informática de Gestão', 1, 1, 120),
('Matemática I', 'MAT101', 'Informática de Gestão', 1, 1, 90),
('Português Técnico', 'PT101', 'Informática de Gestão', 1, 1, 60),
('Gestão Empresarial', 'GES101', 'Informática de Gestão', 1, 1, 90),
('Inglês Técnico', 'ING101', 'Informática de Gestão', 1, 1, 60),
('Sistemas de Informação', 'SI101', 'Informática de Gestão', 1, 2, 120),
('Matemática II', 'MAT102', 'Informática de Gestão', 1, 2, 90),
('Contabilidade Geral', 'CONT101', 'Informática de Gestão', 1, 2, 90),
('Algoritmos e Programação', 'AP101', 'Informática de Gestão', 1, 2, 120),
('Economia', 'ECO101', 'Informática de Gestão', 1, 2, 60),

-- 2º Ano
('Base de Dados', 'BD201', 'Informática de Gestão', 2, 1, 120),
('Redes de Computadores', 'RC201', 'Informática de Gestão', 2, 1, 90),
('Programação Web', 'PW201', 'Informática de Gestão', 2, 1, 120),
('Gestão de Projetos', 'GP201', 'Informática de Gestão', 2, 1, 90),
('Estatística Aplicada', 'EST201', 'Informática de Gestão', 2, 1, 60),
('Sistemas Operativos', 'SO201', 'Informática de Gestão', 2, 2, 90),
('Programação Orientada a Objetos', 'POO201', 'Informática de Gestão', 2, 2, 120),
('Gestão Financeira', 'GF201', 'Informática de Gestão', 2, 2, 90),
('Ética e Deontologia Profissional', 'EDP201', 'Informática de Gestão', 2, 2, 60),
('Sistemas de Apoio à Decisão', 'SAD201', 'Informática de Gestão', 2, 2, 90),

-- 3º Ano
('Segurança Informática', 'SI301', 'Informática de Gestão', 3, 1, 120),
('Gestão de Redes', 'GR301', 'Informática de Gestão', 3, 1, 90),
('Programação Móvel', 'PM301', 'Informática de Gestão', 3, 1, 120),
('Auditoria de Sistemas', 'AS301', 'Informática de Gestão', 3, 1, 90),
('Empreendedorismo', 'EMP301', 'Informática de Gestão', 3, 1, 60),
('Projeto Final', 'PF301', 'Informática de Gestão', 3, 2, 180),
('Estágio Profissional', 'EST301', 'Informática de Gestão', 3, 2, 240),
('Gestão de Qualidade', 'GQ301', 'Informática de Gestão', 3, 2, 90),
('Marketing Digital', 'MD301', 'Informática de Gestão', 3, 2, 60),
('Legislação Informática', 'LI301', 'Informática de Gestão', 3, 2, 60);

-- Inserir turmas
INSERT INTO turmas (nome, curso, ano_letivo, sala) VALUES
('10ª A - Informática de Gestão', 'Informática de Gestão', '2023/2024', 'Sala 101'),
('10ª B - Informática de Gestão', 'Informática de Gestão', '2023/2024', 'Sala 102'),
('11ª A - Informática de Gestão', 'Informática de Gestão', '2023/2024', 'Sala 201'),
('11ª B - Informática de Gestão', 'Informática de Gestão', '2023/2024', 'Sala 202'),
('12ª A - Informática de Gestão', 'Informática de Gestão', '2023/2024', 'Sala 301'),
('12ª B - Informática de Gestão', 'Informática de Gestão', '2023/2024', 'Sala 302');

-- Inserir diretores e coordenadores
INSERT INTO usuarios (numero_processo, nome_completo, email, tipo, cargo, telefone) VALUES
-- Diretores
('DIR001', 'Dr. Manuel António', 'diretor.geral@imel.edu.ao', 'diretor', 'Diretor Geral', '+244 922 111 111'),
('DIR002', 'Dra. Sofia Mendes', 'diretor.admin@imel.edu.ao', 'diretor', 'Diretor Administrativo', '+244 922 111 112'),
('DIR003', 'Prof. Carlos Lopes', 'diretor.pedagogico@imel.edu.ao', 'diretor', 'Diretor Pedagógico', '+244 922 111 113'),
-- Coordenador do curso
('COORD001', 'Eng. João Silva', 'coordenador.ig@imel.edu.ao', 'coordenador', 'Coordenador Informática Gestão', '+244 922 111 114');

-- Inserir professores
INSERT INTO usuarios (numero_processo, nome_completo, email, tipo, departamento, cargo, telefone) VALUES
-- Professores de Informática
('PROF001', 'Prof. Maria Silva', 'maria.silva@imel.edu.ao', 'professor', 'Informática', 'Professor de Programação', '+244 922 222 001'),
('PROF002', 'Prof. António Costa', 'antonio.costa@imel.edu.ao', 'professor', 'Informática', 'Professor de Base de Dados', '+244 922 222 002'),
('PROF003', 'Prof. Ana Rodrigues', 'ana.rodrigues@imel.edu.ao', 'professor', 'Informática', 'Professor de Redes', '+244 922 222 003'),
('PROF004', 'Prof. Pedro Santos', 'pedro.santos@imel.edu.ao', 'professor', 'Informática', 'Professor de Sistemas', '+244 922 222 004'),
('PROF005', 'Prof. Marta Fernandes', 'marta.fernandes@imel.edu.ao', 'professor', 'Gestão', 'Professora de Gestão', '+244 922 222 005'),
('PROF006', 'Prof. Rui Oliveira', 'rui.oliveira@imel.edu.ao', 'professor', 'Matemática', 'Professor de Matemática', '+244 922 222 006');

-- Atualizar turmas com professores responsáveis
UPDATE turmas SET professor_responsavel = 
    CASE nome
        WHEN '10ª A - Informática de Gestão' THEN (SELECT id FROM usuarios WHERE numero_processo = 'PROF001')
        WHEN '10ª B - Informática de Gestão' THEN (SELECT id FROM usuarios WHERE numero_processo = 'PROF002')
        WHEN '11ª A - Informática de Gestão' THEN (SELECT id FROM usuarios WHERE numero_processo = 'PROF003')
        WHEN '11ª B - Informática de Gestão' THEN (SELECT id FROM usuarios WHERE numero_processo = 'PROF004')
        WHEN '12ª A - Informática de Gestão' THEN (SELECT id FROM usuarios WHERE numero_processo = 'PROF005')
        WHEN '12ª B - Informática de Gestão' THEN (SELECT id FROM usuarios WHERE numero_processo = 'PROF006')
    END;

-- Inserir alunos (45 por turma - exemplo para 2 turmas)
-- Note: Vou criar um procedimento para gerar 90 alunos
DELIMITER //
CREATE PROCEDURE GerarAlunos()
BEGIN
    DECLARE i INT DEFAULT 1;
    DECLARE turma_num INT;
    DECLARE turma_letra CHAR(1);
    DECLARE ano_turma INT;
    
    WHILE i <= 90 DO
        -- Alternar entre turmas A e B
        SET turma_letra = IF(MOD(i, 2) = 1, 'A', 'B');
        SET ano_turma = IF(i <= 30, 10, IF(i <= 60, 11, 12));
        
        INSERT INTO usuarios (
            numero_processo,
            nome_completo,
            email,
            tipo,
            turma_id,
            telefone,
            data_nascimento
        ) VALUES (
            CONCAT('AL', LPAD(i, 6, '0')),
            CONCAT('Aluno ', i, ' ', 
                   CASE WHEN i <= 30 THEN 'da Silva' 
                        WHEN i <= 60 THEN 'Santos' 
                        ELSE 'Costa' END),
            CONCAT('aluno', i, '@imel.edu.ao'),
            'aluno',
            (SELECT id FROM turmas WHERE nome = CONCAT(ano_turma, 'ª ', turma_letra, ' - Informática de Gestão')),
            CONCAT('+244 923 ', LPAD(FLOOR(RAND() * 900000) + 100000, 6, '0')),
            DATE_SUB(CURDATE(), INTERVAL FLOOR(RAND() * 5) + 16 YEAR)
        );
        
        SET i = i + 1;
    END WHILE;
END//
DELIMITER ;

CALL GerarAlunos();

-- Inserir materiais na biblioteca
INSERT INTO biblioteca (titulo, autor, tipo, categoria, curso, descricao) VALUES
('Introdução à Programação em Python', 'João Silva', 'livro', 'Programação', 'Informática de Gestão', 'Livro introdutório para programação Python'),
('Gestão de Base de Dados MySQL', 'Maria Santos', 'apostila', 'Base de Dados', 'Informática de Gestão', 'Material completo sobre MySQL'),
('Redes de Computadores - Fundamentos', 'Carlos Mendes', 'video', 'Redes', 'Informática de Gestão', 'Videoaulas sobre redes'),
('Matemática para Informática', 'Ana Costa', 'livro', 'Matemática', 'Informática de Gestão', 'Matemática aplicada à informática'),
('Gestão Empresarial Moderna', 'Pedro Oliveira', 'artigo', 'Gestão', 'Informática de Gestão', 'Artigos sobre gestão empresarial');

-- Inserir produtos na papelaria
INSERT INTO papelaria (nome_produto, descricao, categoria, preco, quantidade) VALUES
('Caderno Universitário 96p', 'Caderno universitário capa dura', 'Material Escrita', 350.00, 100),
('Caneta BIC Azul', 'Caneta esferográfica azul', 'Material Escrita', 50.00, 500),
('Calculadora Científica', 'Calculadora científica básica', 'Material Escolar', 2500.00, 50),
('Pendrive 32GB', 'Pendrive USB 3.0 32GB', 'Tecnologia', 1500.00, 30),
('Fichário A4', 'Fichário com 100 folhas', 'Organização', 1200.00, 40),
('Livro de Exercícios SQL', 'Livro com exercícios de SQL', 'Livros', 2500.00, 20);

-- Inserir eventos no calendário
INSERT INTO eventos (titulo, descricao, tipo, data_inicio, data_fim, publico_alvo, cor) VALUES
('Início do 2º Trimestre', 'Início das aulas do 2º trimestre', 'academico', '2024-03-01 08:00:00', '2024-03-01 17:00:00', 'todos', '#3B82F6'),
('Teste de Matemática', 'Teste global de Matemática - 10ª classe', 'academico', '2024-03-15 08:00:00', '2024-03-15 10:00:00', 'alunos', '#EF4444'),
('Reunião de Pais', 'Reunião geral com encarregados de educação', 'administrativo', '2024-03-25 15:00:00', '2024-03-25 17:00:00', 'encarregados', '#10B981'),
('Workshop de Programação', 'Workshop sobre Python para iniciantes', 'cultural', '2024-04-05 14:00:00', '2024-04-05 18:00:00', 'alunos', '#F59E0B'),
('Feriado Nacional', 'Dia da Liberdade', 'administrativo', '2024-04-04 00:00:00', '2024-04-04 23:59:59', 'todos', '#8B5CF6');

-- Configurações do sistema
INSERT INTO config_sistema (chave, valor, descricao) VALUES
('nota_minima_aprovacao', '10', 'Nota mínima para aprovação'),
('ano_letivo_atual', '2023/2024', 'Ano letivo em vigor'),
('manutencao_sistema', 'false', 'Modo de manutenção do sistema'),
('email_contato', 'suporte@imel.edu.ao', 'Email de contacto do sistema'),
('telefone_escola', '+244 222 123 456', 'Telefone da escola');