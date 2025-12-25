// Configuração da API
const API_BASE_URL = 'http://localhost:3000/api';

// Sistema Intranet IMEL - JavaScript Atualizado
document.addEventListener('DOMContentLoaded', function() {
    // Estado Global
    const state = {
        currentUser: null,
        currentUserType: null,
        isLoggedIn: false,
        theme: localStorage.getItem('theme') || 'dark',
        token: localStorage.getItem('token')
    };

    // ========== FUNÇÕES DE API ==========
    const api = {
        // Requisição genérica
        async request(endpoint, options = {}) {
            const url = `${API_BASE_URL}${endpoint}`;
            
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            
            if (state.token) {
                headers['Authorization'] = `Bearer ${state.token}`;
            }
            
            try {
                const response = await fetch(url, {
                    ...options,
                    headers
                });
                
                if (response.status === 401) {
                    // Token expirado ou inválido
                    logout();
                    showAlert('Sessão expirada. Por favor, faça login novamente.', 'warning');
                    return null;
                }
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.erro || 'Erro na requisição');
                }
                
                return data;
            } catch (error) {
                console.error('Erro na requisição:', error);
                showAlert(error.message || 'Erro de conexão com o servidor', 'danger');
                throw error;
            }
        },
        
        // Autenticação
        async login(numero_processo, senha) {
            return this.request('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ numero_processo, senha })
            });
        },
        
        async registrar(numero_processo, senha, confirmar_senha) {
            return this.request('/auth/registrar', {
                method: 'POST',
                body: JSON.stringify({ numero_processo, senha, confirmar_senha })
            });
        },
        
        async verificarToken() {
            return this.request('/auth/verificar');
        },
        
        async obterPerfil() {
            return this.request('/auth/perfil');
        },
        
        async atualizarPerfil(dados) {
            return this.request('/auth/perfil', {
                method: 'PUT',
                body: JSON.stringify(dados)
            });
        },
        
        async alterarSenha(senha_atual, nova_senha, confirmar_senha) {
            return this.request('/auth/alterar-senha', {
                method: 'PUT',
                body: JSON.stringify({ senha_atual, nova_senha, confirmar_senha })
            });
        },
        
        // Aluno
        async obterDashboardAluno() {
            return this.request('/aluno/dashboard');
        },
        
        async obterNotasAluno(disciplina_id) {
            const query = disciplina_id ? `?disciplina_id=${disciplina_id}` : '';
            return this.request(`/aluno/notas${query}`);
        },
        
        async obterFrequenciasAluno(mes, ano) {
            const query = `?mes=${mes || new Date().getMonth() + 1}&ano=${ano || new Date().getFullYear()}`;
            return this.request(`/aluno/frequencias${query}`);
        },
        
        async obterHorarioAluno() {
            return this.request('/aluno/horario');
        },
        
        async obterDocumentosAluno() {
            return this.request('/aluno/documentos');
        },
        
        async obterMensagensAluno(nao_lidas = false) {
            const query = nao_lidas ? '?nao_lidas=true' : '';
            return this.request(`/aluno/mensagens${query}`);
        },
        
        async enviarMensagem(destinatario_id, assunto, conteudo) {
            return this.request('/aluno/mensagens', {
                method: 'POST',
                body: JSON.stringify({ destinatario_id, assunto, conteudo })
            });
        },
        
        async marcarMensagemComoLida(mensagem_id) {
            return this.request(`/aluno/mensagens/${mensagem_id}/ler`, {
                method: 'PUT'
            });
        },
        
        // Professor
        async obterDashboardProfessor() {
            return this.request('/professor/dashboard');
        },
        
        async obterTurmasProfessor() {
            return this.request('/professor/turmas');
        },
        
        async obterAlunosTurma(turma_id) {
            return this.request(`/professor/turmas/${turma_id}/alunos`);
        },
        
        async registrarNota(notaData) {
            return this.request('/professor/notas', {
                method: 'POST',
                body: JSON.stringify(notaData)
            });
        },
        
        async registrarFrequenciasMassa(frequenciaData) {
            return this.request('/professor/frequencias/massa', {
                method: 'POST',
                body: JSON.stringify(frequenciaData)
            });
        },
        
        async obterMateriaisProfessor() {
            return this.request('/professor/materiais');
        },
        
        async adicionarMaterial(materialData) {
            return this.request('/professor/materiais', {
                method: 'POST',
                body: JSON.stringify(materialData)
            });
        },
        
        async obterRelatorioTurma(turma_id) {
            return this.request(`/professor/relatorios/turma/${turma_id}`);
        },
        
        // Admin
        async obterDashboardAdmin() {
            return this.request('/admin/dashboard');
        },
        
        async obterUsuarios(filtros = {}) {
            const query = new URLSearchParams(filtros).toString();
            return this.request(`/admin/usuarios${query ? '?' + query : ''}`);
        },
        
        async obterUsuario(id) {
            return this.request(`/admin/usuarios/${id}`);
        },
        
        async criarUsuario(usuarioData) {
            return this.request('/admin/usuarios', {
                method: 'POST',
                body: JSON.stringify(usuarioData)
            });
        },
        
        async atualizarUsuario(id, dados) {
            return this.request(`/admin/usuarios/${id}`, {
                method: 'PUT',
                body: JSON.stringify(dados)
            });
        },
        
        async redefinirSenhaUsuario(id, nova_senha) {
            return this.request(`/admin/usuarios/${id}/redefinir-senha`, {
                method: 'PUT',
                body: JSON.stringify({ nova_senha })
            });
        },
        
        async desativarUsuario(id) {
            return this.request(`/admin/usuarios/${id}`, {
                method: 'DELETE'
            });
        },
        
        async obterTurmas() {
            return this.request('/admin/turmas');
        },
        
        async criarTurma(turmaData) {
            return this.request('/admin/turmas', {
                method: 'POST',
                body: JSON.stringify(turmaData)
            });
        },
        
        async obterDisciplinas() {
            return this.request('/admin/disciplinas');
        },
        
        async criarDisciplina(disciplinaData) {
            return this.request('/admin/disciplinas', {
                method: 'POST',
                body: JSON.stringify(disciplinaData)
            });
        },
        
        async realizarMatriculas(matriculaData) {
            return this.request('/admin/matriculas/massa', {
                method: 'POST',
                body: JSON.stringify(matriculaData)
            });
        },
        
        async obterConfiguracoes() {
            return this.request('/admin/configuracoes');
        },
        
        async atualizarConfiguracoes(configuracoes) {
            return this.request('/admin/configuracoes', {
                method: 'PUT',
                body: JSON.stringify({ configuracoes })
            });
        },
        
        // Biblioteca
        async obterItensBiblioteca(filtros = {}) {
            const query = new URLSearchParams(filtros).toString();
            return this.request(`/biblioteca${query ? '?' + query : ''}`);
        },
        
        async obterItemBiblioteca(id) {
            return this.request(`/biblioteca/${id}`);
        },
        
        async registrarDownloadItem(id) {
            return this.request(`/biblioteca/${id}/download`, {
                method: 'POST'
            });
        },
        
        async obterEstatisticasBiblioteca() {
            return this.request('/biblioteca/estatisticas');
        }
    };

    // ========== SISTEMA DE ALERTAS ==========
    function showAlert(message, type = 'info') {
        const alertContainer = document.getElementById('alertContainer');
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        
        // Ícone baseado no tipo
        let icon = 'info-circle';
        switch(type) {
            case 'success': icon = 'check-circle'; break;
            case 'warning': icon = 'exclamation-triangle'; break;
            case 'danger': icon = 'times-circle'; break;
            case 'info': icon = 'info-circle'; break;
        }
        
        alert.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        alertContainer.appendChild(alert);
        
        // Remover alerta após 5 segundos
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.parentNode.removeChild(alert);
                }
            }, 300);
        }, 5000);
    }

    // ========== THEME TOGGLE ==========
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    function setTheme(theme) {
        if (theme === 'light') {
            body.classList.add('light-mode');
            body.setAttribute('data-theme', 'light');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            body.classList.remove('light-mode');
            body.setAttribute('data-theme', 'dark');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
        localStorage.setItem('theme', theme);
        state.theme = theme;
    }
    
    themeToggle.addEventListener('click', function() {
        setTheme(state.theme === 'dark' ? 'light' : 'dark');
    });
    
    // Carregar tema salvo
    setTheme(state.theme);

    // ========== NAVEGAÇÃO PRINCIPAL ==========
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    const navLinksContainer = document.querySelector('.nav-links');
    
    function navigateToPage(pageId) {
        // Esconder todas as páginas
        pages.forEach(page => page.classList.remove('active'));
        
        // Ativar página selecionada
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
        }
        
        // Atualizar navegação apenas se não estiver logado
        if (!state.isLoggedIn) {
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${pageId}`) {
                    link.classList.add('active');
                }
            });
        }
    }
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const pageId = this.getAttribute('href').substring(1);
            navigateToPage(pageId);
        });
    });

    // ========== MAPA DA ESCOLA ==========
    const schoolLocation = document.getElementById('schoolLocation');
    const openMapBtn = document.getElementById('openMapBtn');
    
    function openSchoolMap() {
        window.open('https://www.google.com/maps?q=56CW%2B38V+Luanda+Angola', '_blank');
    }
    
    if (schoolLocation) {
        schoolLocation.addEventListener('click', openSchoolMap);
    }
    
    if (openMapBtn) {
        openMapBtn.addEventListener('click', openSchoolMap);
    }

    // ========== SISTEMA DE LOGIN ==========
    const loginModal = document.getElementById('loginModal');
    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const accessIntraBtn = document.getElementById('accessIntraBtn');
    const accessDashboardBtn = document.getElementById('accessDashboardBtn');
    const loginClose = document.getElementById('loginClose');
    const loginSubmit = document.getElementById('loginSubmit');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const resetPasswordClose = document.getElementById('resetPasswordClose');
    const resetPasswordSubmit = document.getElementById('resetPasswordSubmit');
    const backToLogin = document.getElementById('backToLogin');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const usernameInput = document.getElementById('username');
    const toggleCredentialsBtn = document.getElementById('toggleCredentialsBtn');
    const demoCredentialsToggle = document.getElementById('demoCredentialsToggle');
    const demoCredentialsContent = document.getElementById('demoCredentialsContent');
    
    // Toggle para mostrar/ocultar credenciais de demonstração
    toggleCredentialsBtn.addEventListener('click', function() {
        demoCredentialsContent.classList.toggle('collapsed');
        const isCollapsed = demoCredentialsContent.classList.contains('collapsed');
        demoCredentialsToggle.innerHTML = `<i class="fas fa-chevron-${isCollapsed ? 'down' : 'up'}"></i> Credenciais de Demonstração`;
        
        // Atualizar texto do botão principal
        this.innerHTML = `<i class="fas fa-eye${isCollapsed ? '' : '-slash'}"></i> ${isCollapsed ? 'Ver' : 'Ocultar'} Credenciais de Demonstração`;
    });
    
    demoCredentialsToggle.addEventListener('click', function() {
        demoCredentialsContent.classList.toggle('collapsed');
        const isCollapsed = demoCredentialsContent.classList.contains('collapsed');
        this.innerHTML = `<i class="fas fa-chevron-${isCollapsed ? 'down' : 'up'}"></i> Credenciais de Demonstração`;
        
        // Atualizar texto do botão principal
        toggleCredentialsBtn.innerHTML = `<i class="fas fa-eye${isCollapsed ? '' : '-slash'}"></i> ${isCollapsed ? 'Ver' : 'Ocultar'} Credenciais de Demonstração`;
    });
    
    // Copiar credenciais ao clicar nos botões
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('copy-btn')) {
            const credential = e.target.closest('.credential');
            const user = credential.getAttribute('data-user');
            const pass = credential.getAttribute('data-pass');
            
            // Preencher automaticamente os campos de login
            usernameInput.value = user;
            passwordInput.value = pass;
            
            // Feedback visual
            const originalText = e.target.textContent;
            e.target.textContent = 'Copiado!';
            e.target.style.backgroundColor = 'var(--primary)';
            e.target.style.color = 'white';
            
            setTimeout(() => {
                e.target.textContent = originalText;
                e.target.style.backgroundColor = '';
                e.target.style.color = '';
            }, 1500);
            
            showAlert('Credenciais copiadas para os campos de login', 'success');
        }
    });

    // Mostrar/ocultar palavra-passe
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });

    // Abrir modal de login
    accessIntraBtn.addEventListener('click', () => loginModal.classList.add('active'));
    accessDashboardBtn.addEventListener('click', () => loginModal.classList.add('active'));

    // Fechar modal de login
    loginClose.addEventListener('click', () => loginModal.classList.remove('active'));

    // Esqueceu a palavra-passe
    forgotPasswordLink.addEventListener('click', function(e) {
        e.preventDefault();
        loginModal.classList.remove('active');
        resetPasswordModal.classList.add('active');
    });

    // Fechar modal de recuperação
    resetPasswordClose.addEventListener('click', () => resetPasswordModal.classList.remove('active'));
    backToLogin.addEventListener('click', function(e) {
        e.preventDefault();
        resetPasswordModal.classList.remove('active');
        loginModal.classList.add('active');
    });

    // Submeter recuperação de palavra-passe
    resetPasswordSubmit.addEventListener('click', async function() {
        const email = document.getElementById('resetEmail').value;
        const userType = document.getElementById('userTypeReset').value;
        
        if (!email) {
            showAlert('Por favor, insira o seu email', 'warning');
            return;
        }
        
        // TODO: Implementar integração com serviço de email
        showAlert(`Link de recuperação enviado para ${email} (${userType})`, 'success');
        setTimeout(() => {
            resetPasswordModal.classList.remove('active');
            loginModal.classList.add('active');
        }, 2000);
    });

    // ========== AUTENTICAÇÃO ==========
    loginSubmit.addEventListener('click', async function() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        
        if (!username || !password) {
            showAlert('Por favor, preencha todos os campos', 'warning');
            return;
        }
        
        try {
            const resultado = await api.login(username, password);
            
            if (resultado) {
                state.currentUser = resultado.usuario;
                state.currentUserType = resultado.usuario.tipo;
                state.isLoggedIn = true;
                state.token = resultado.token;
                
                // Salvar token no localStorage
                localStorage.setItem('token', resultado.token);
                localStorage.setItem('user', JSON.stringify(resultado.usuario));
                
                // Fechar modal de login
                loginModal.classList.remove('active');
                
                // Limpar campos
                usernameInput.value = '';
                passwordInput.value = '';
                
                // Esconder navegação
                if (navLinksContainer) {
                    navLinksContainer.classList.add('hidden');
                }
                
                // Redirecionar para o dashboard apropriado
                redirectToDashboard(resultado.usuario.tipo, resultado.usuario);
                
                showAlert(`Bem-vindo, ${resultado.usuario.nome_completo}!`, 'success');
            }
        } catch (error) {
            showAlert('Credenciais inválidas. Tente novamente.', 'danger');
        }
    });

    // ========== REDIRECIONAMENTO PARA DASHBOARDS ==========
    function redirectToDashboard(userType, user) {
        // Navegar para o dashboard correto
        navigateToPage(`dashboard-${userType}`);
        
        // Atualizar informações do utilizador
        updateUserInfo(userType, user);
        
        // Carregar conteúdo do dashboard
        loadDashboardContent(userType, 'overview');
    }

    function updateUserInfo(userType, user) {
        // Atualizar informações nos dashboards
        document.querySelectorAll('.user-profile .avatar').forEach(avatar => {
            avatar.textContent = user.avatar || 'US';
        });
        
        document.querySelectorAll('.user-profile .user-name').forEach(name => {
            name.textContent = user.nome_completo;
        });
        
        document.querySelectorAll('.user-profile .user-role').forEach(role => {
            if (userType === 'aluno') {
                role.textContent = user.turma_nome || 'Aluno';
            } else if (userType === 'professor') {
                role.textContent = user.departamento ? `Professor - ${user.departamento}` : 'Professor';
            } else if (userType === 'admin' || userType === 'diretor') {
                role.textContent = user.cargo || 'Administrador do Sistema';
            } else if (userType === 'coordenador') {
                role.textContent = 'Coordenador do Curso';
            } else if (userType === 'encarregado') {
                role.textContent = 'Encarregado de Educação';
            }
        });
    }

    // ========== LOGOUT ==========
    function logout() {
        state.currentUser = null;
        state.currentUserType = null;
        state.isLoggedIn = false;
        state.token = null;
        
        // Remover do localStorage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Mostrar navegação novamente
        if (navLinksContainer) {
            navLinksContainer.classList.remove('hidden');
        }
        
        navigateToPage('home');
        showAlert('Sessão terminada com sucesso', 'info');
    }

    function setupLogoutButtons() {
        document.querySelectorAll('[id^="logoutBtn"]').forEach(btn => {
            btn.addEventListener('click', function() {
                logout();
            });
        });
    }

    // ========== SISTEMA DE DASHBOARDS ==========
    // Conteúdo dos dashboards por tipo de utilizador
    const dashboardContent = {
        'aluno': {
            'overview': getAlunoOverview,
            'grades': getAlunoGrades,
            'schedule': getAlunoSchedule,
            'attendance': getAlunoAttendance,
            'documents': getAlunoDocuments,
            'messages': getAlunoMessages,
            'calendar': getAlunoCalendar,
            'library': getAlunoLibrary,
            'settings': getAlunoSettings
        },
        'professor': {
            'overview': getProfessorOverview,
            'classes': getProfessorClasses,
            'grades': getProfessorGrades,
            'attendance': getProfessorAttendance,
            'materials': getProfessorMaterials,
            'schedule': getProfessorSchedule,
            'messages': getProfessorMessages,
            'calendar': getProfessorCalendar,
            'library': getProfessorLibrary,
            'reports': getProfessorReports
        },
        'admin': {
            'overview': getAdminOverview,
            'students': getAdminStudents,
            'teachers': getAdminTeachers,
            'classes': getAdminClasses,
            'resources': getAdminResources,
            'reports': getAdminReports,
            'system': getAdminSystem,
            'calendar': getAdminCalendar,
            'library': getAdminLibrary
        },
        'diretor': {
            'overview': getAdminOverview, // Usa o mesmo dashboard do admin
            'students': getAdminStudents,
            'teachers': getAdminTeachers,
            'classes': getAdminClasses,
            'resources': getAdminResources,
            'reports': getAdminReports,
            'system': getAdminSystem,
            'calendar': getAdminCalendar,
            'library': getAdminLibrary
        },
        'coordenador': {
            'overview': getProfessorOverview, // Usa o mesmo dashboard do professor
            'classes': getProfessorClasses,
            'grades': getProfessorGrades,
            'attendance': getProfessorAttendance,
            'materials': getProfessorMaterials,
            'schedule': getProfessorSchedule,
            'messages': getProfessorMessages,
            'calendar': getProfessorCalendar,
            'library': getProfessorLibrary,
            'reports': getProfessorReports
        },
        'encarregado': {
            'overview': getEncarregadoOverview,
            'students': getEncarregadoStudents,
            'grades': getEncarregadoGrades,
            'attendance': getEncarregadoAttendance,
            'messages': getEncarregadoMessages,
            'documents': getEncarregadoDocuments,
            'calendar': getEncarregadoCalendar
        }
    };

    async function loadDashboardContent(userType, view) {
        const contentContainer = document.getElementById(`${userType}DashboardContent`);
        if (!contentContainer) return;
        
        // Mostrar skeleton loading
        contentContainer.innerHTML = `
            <div class="skeleton" style="height: 120px; margin-bottom: 1.5rem;"></div>
            <div class="skeleton" style="height: 300px; margin-bottom: 1.5rem;"></div>
            <div class="skeleton" style="height: 200px;"></div>
        `;
        
        try {
            if (dashboardContent[userType] && dashboardContent[userType][view]) {
                contentContainer.innerHTML = await dashboardContent[userType][view]();
                
                // Inicializar calendário se necessário
                if (view === 'calendar') {
                    initCalendar(userType);
                }
                
                // Configurar botões de ação
                setupActionButtons();
            }
            
            // Atualizar menu ativo
            document.querySelectorAll(`#dashboard-${userType} .menu-item`).forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('data-dashboard') === view) {
                    item.classList.add('active');
                }
            });
            
            // Configurar eventos de menu
            setupMenuEvents(userType);
            
            // Adicionar eventos aos botões de ação
            setupActionButtons();
            setupLogoutButtons();
        } catch (error) {
            console.error('Erro ao carregar conteúdo:', error);
            contentContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro ao carregar conteúdo: ${error.message}</span>
                </div>
            `;
        }
    }

    function setupMenuEvents(userType) {
        document.querySelectorAll(`#dashboard-${userType} .menu-item`).forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                const view = this.getAttribute('data-dashboard');
                loadDashboardContent(userType, view);
            });
        });
    }

    // ========== CALENDÁRIO ==========
    function initCalendar(userType) {
        const calendarEl = document.getElementById('calendar');
        if (!calendarEl) return;
        
        // TODO: Carregar eventos da API
        const calendar = new FullCalendar.Calendar(calendarEl, {
            locale: 'pt',
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: [
                {
                    title: 'Teste de Economia',
                    start: new Date(new Date().setDate(new Date().getDate() + 2)),
                    end: new Date(new Date().setDate(new Date().getDate() + 2)),
                    color: '#EF4444'
                },
                {
                    title: 'Entrega de Projeto',
                    start: new Date(new Date().setDate(new Date().getDate() + 5)),
                    end: new Date(new Date().setDate(new Date().getDate() + 5)),
                    color: '#10B981'
                },
                {
                    title: 'Reunião de Pais',
                    start: new Date(new Date().setDate(new Date().getDate() + 7)),
                    end: new Date(new Date().setDate(new Date().getDate() + 7)),
                    color: '#3B82F6'
                },
                {
                    title: 'Feriado Nacional',
                    start: new Date(new Date().setDate(new Date().getDate() + 10)),
                    end: new Date(new Date().setDate(new Date().getDate() + 10)),
                    color: '#F59E0B'
                }
            ],
            eventClick: function(info) {
                showAlert(`Evento: ${info.event.title}`, 'info');
            }
        });
        
        calendar.render();
    }

    // ========== BOTÕES DE AÇÃO ==========
    function setupActionButtons() {
        // Botões Ver
        document.querySelectorAll('.action-btn-view').forEach(btn => {
            btn.addEventListener('click', function() {
                showAlert('Visualizando detalhes...', 'info');
            });
        });
        
        // Botões Editar
        document.querySelectorAll('.action-btn-edit').forEach(btn => {
            btn.addEventListener('click', function() {
                showAlert('Modo de edição ativado', 'warning');
            });
        });
        
        // Botões Eliminar
        document.querySelectorAll('.action-btn-delete').forEach(btn => {
            btn.addEventListener('click', function() {
                if (confirm('Tem certeza que deseja eliminar este item?')) {
                    showAlert('Item eliminado com sucesso', 'success');
                }
            });
        });
        
        // Botões Download
        document.querySelectorAll('.action-btn-download').forEach(btn => {
            btn.addEventListener('click', function() {
                showAlert('Download iniciado...', 'success');
            });
        });
        
        // Botões Salvar
        document.querySelectorAll('.action-btn-save').forEach(btn => {
            btn.addEventListener('click', async function() {
                try {
                    // TODO: Implementar lógica de salvar
                    showAlert('Alterações guardadas com sucesso', 'success');
                } catch (error) {
                    showAlert('Erro ao guardar alterações', 'danger');
                }
            });
        });
    }

    // ========== CONTEÚDO DOS DASHBOARDS ==========
    // Aluno
    async function getAlunoOverview() {
        try {
            const data = await api.obterDashboardAluno();
            
            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title">Visão Geral - ${data.aluno.nome_completo}</h2>
                            <p class="card-subtitle">${data.aluno.turma_nome || 'Aluno'} | Ano Letivo 2023/2024</p>
                        </div>
                        <button class="btn btn-primary" id="printReport">
                            <i class="fas fa-print"></i> Imprimir Boletim
                        </button>
                    </div>
                    
                    <div class="stats-grid" style="margin-bottom: 2rem;">
                        <div class="stat-card">
                            <div class="stat-value">${data.estatisticas.media_geral ? data.estatisticas.media_geral.toFixed(1) : '0.0'}</div>
                            <div class="stat-label">Média Geral</div>
                            ${data.estatisticas.media_geral && data.estatisticas.media_geral >= 10 ? 
                                `<div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                                    <span class="badge badge-success">Aprovado</span>
                                </div>` :
                                `<div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                                    <span class="badge badge-danger">Reprovado</span>
                                </div>`
                            }
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-value">${data.estatisticas.percentagem_presenca ? data.estatisticas.percentagem_presenca.toFixed(1) : '0'}%</div>
                            <div class="stat-label">Presença</div>
                            <div style="margin-top: 0.5rem;">
                                <span style="font-size: 0.8rem;">${data.estatisticas.total_disciplinas || 0} disciplinas</span>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-value">${data.estatisticas.total_disciplinas || 0}</div>
                            <div class="stat-label">Disciplinas</div>
                            <div style="margin-top: 0.5rem;">
                                <span style="font-size: 0.8rem;">Todas ativas</span>
                            </div>
                        </div>
                        
                        <div class="stat-card">
                            <div class="stat-value">${data.estatisticas.total_notas || 0}</div>
                            <div class="stat-label">Avaliações</div>
                            <div style="margin-top: 0.5rem;">
                                <span style="font-size: 0.8rem;">Este período</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                        <div class="card">
                            <h3 class="card-title" style="margin-bottom: 1rem;">Próximas Avaliações</h3>
                            ${data.proximos_eventos && data.proximos_eventos.length > 0 ?
                                `<table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Data</th>
                                            <th>Evento</th>
                                            <th>Tipo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${data.proximos_eventos.slice(0, 5).map(evento => `
                                            <tr>
                                                <td>${new Date(evento.data_inicio).toLocaleDateString('pt-PT')}</td>
                                                <td>${evento.titulo}</td>
                                                <td><span class="badge ${evento.tipo === 'academico' ? 'badge-danger' : evento.tipo === 'administrativo' ? 'badge-info' : 'badge-warning'}">${evento.tipo}</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>` :
                                '<p style="text-align: center; padding: 2rem; color: var(--dark-text-secondary);">Sem avaliações próximas</p>'
                            }
                        </div>
                        
                        <div class="card">
                            <h3 class="card-title" style="margin-bottom: 1rem;">Disciplinas Atuais</h3>
                            ${data.disciplinas && data.disciplinas.length > 0 ?
                                `<div style="display: flex; flex-direction: column; gap: 1rem;">
                                    ${data.disciplinas.slice(0, 3).map(disciplina => `
                                        <div style="padding: 1rem; background-color: var(--dark-card); border-radius: var(--radius);">
                                            <div style="font-weight: 600; margin-bottom: 0.25rem;">${disciplina.nome}</div>
                                            <div style="font-size: 0.85rem; color: var(--dark-text-secondary);">
                                                Média: ${disciplina.media_geral ? disciplina.media_geral.toFixed(1) : '--'}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>` :
                                '<p style="text-align: center; padding: 2rem; color: var(--dark-text-secondary);">Nenhuma disciplina matriculada</p>'
                            }
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            return `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro ao carregar dashboard: ${error.message}</span>
                </div>
            `;
        }
    }

    async function getAlunoGrades() {
        try {
            const data = await api.obterNotasAluno();
            
            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title">Notas e Avaliações</h2>
                            <p class="card-subtitle">Ano Letivo 2023/2024</p>
                        </div>
                        <div class="action-buttons-table">
                            <button class="btn btn-primary" id="exportGrades">
                                <i class="fas fa-download"></i> Exportar
                            </button>
                            <button class="btn btn-secondary" id="printGrades">
                                <i class="fas fa-print"></i> Imprimir
                            </button>
                        </div>
                    </div>
                    
                    ${data.notas_por_disciplina && data.notas_por_disciplina.length > 0 ?
                        data.notas_por_disciplina.map(disciplina => `
                            <div style="margin-bottom: 2rem;">
                                <h3 style="font-weight: 600; margin-bottom: 1rem;">${disciplina.disciplina_nome} - Média: ${disciplina.media.toFixed(1)}</h3>
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Tipo</th>
                                            <th>Valor</th>
                                            <th>Peso</th>
                                            <th>Data</th>
                                            <th>Professor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${disciplina.notas.map(nota => `
                                            <tr>
                                                <td>
                                                    ${nota.tipo_avaliacao === 'teste1' ? '1º Teste' : 
                                                      nota.tipo_avaliacao === 'teste2' ? '2º Teste' : 
                                                      nota.tipo_avaliacao === 'projeto' ? 'Projeto' : 
                                                      nota.tipo_avaliacao === 'participacao' ? 'Participação' : 'Exame'}
                                                </td>
                                                <td><strong>${nota.valor}</strong></td>
                                                <td>${nota.peso}</td>
                                                <td>${new Date(nota.data_avaliacao).toLocaleDateString('pt-PT')}</td>
                                                <td>${nota.professor_nome || '--'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `).join('') :
                        '<p style="text-align: center; padding: 2rem; color: var(--dark-text-secondary);">Nenhuma nota registrada</p>'
                    }
                </div>
            `;
        } catch (error) {
            return `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro ao carregar notas: ${error.message}</span>
                </div>
            `;
        }
    }

    async function getAlunoSchedule() {
        try {
            const data = await api.obterHorarioAluno();
            
            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title">Horário Semanal</h2>
                            <p class="card-subtitle">Turma ${state.currentUser.turma_nome || ''} | Ano Letivo 2023/2024</p>
                        </div>
                        <div class="action-buttons-table">
                            <button class="btn btn-secondary" id="viewMonth">
                                <i class="fas fa-calendar-alt"></i> Ver Mês
                            </button>
                            <button class="btn btn-primary" id="downloadSchedule">
                                <i class="fas fa-download"></i> Download
                            </button>
                        </div>
                    </div>
                    
                    ${data.horario && data.horario.length > 0 ?
                        `<table class="data-table">
                            <thead>
                                <tr>
                                    <th>Hora</th>
                                    <th>Segunda</th>
                                    <th>Terça</th>
                                    <th>Quarta</th>
                                    <th>Quinta</th>
                                    <th>Sexta</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${renderHorario(data.horario)}
                            </tbody>
                        </table>` :
                        '<p style="text-align: center; padding: 2rem; color: var(--dark-text-secondary);">Horário não disponível</p>'
                    }
                </div>
            `;
        } catch (error) {
            return `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro ao carregar horário: ${error.message}</span>
                </div>
            `;
        }
    }

    function renderHorario(horario) {
        // Esta função renderiza o horário em formato de tabela
        // O horário deve ser um array de objetos com dia, hora, disciplina, sala, etc.
        // Implementação básica para exemplo
        return `
            <tr>
                <td>08:00-09:30</td>
                <td>
                    <div style="padding: 0.5rem; background-color: rgba(59, 130, 246, 0.1); border-radius: var(--radius);">
                        <div style="font-weight: 600;">Matemática</div>
                        <div style="font-size: 0.85rem;">Sala 12</div>
                    </div>
                </td>
                <td>
                    <div style="padding: 0.5rem; background-color: rgba(16, 185, 129, 0.1); border-radius: var(--radius);">
                        <div style="font-weight: 600;">Economia</div>
                        <div style="font-size: 0.85rem;">Sala 08</div>
                    </div>
                </td>
                <td>
                    <div style="padding: 0.5rem; background-color: rgba(245, 158, 11, 0.1); border-radius: var(--radius);">
                        <div style="font-weight: 600;">Geografia</div>
                        <div style="font-size: 0.85rem;">Sala 15</div>
                    </div>
                </td>
                <td>
                    <div style="padding: 0.5rem; background-color: rgba(139, 92, 246, 0.1); border-radius: var(--radius);">
                        <div style="font-weight: 600;">Português</div>
                        <div style="font-size: 0.85rem;">Sala 10</div>
                    </div>
                </td>
                <td>
                    <div style="padding: 0.5rem; background-color: rgba(236, 72, 153, 0.1); border-radius: var(--radius);">
                        <div style="font-weight: 600;">História</div>
                        <div style="font-size: 0.85rem;">Sala 07</div>
                    </div>
                </td>
            </tr>
        `;
    }

    async function getAlunoAttendance() {
        try {
            const hoje = new Date();
            const data = await api.obterFrequenciasAluno(hoje.getMonth() + 1, hoje.getFullYear());
            
            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title">Registo de Frequências</h2>
                            <p class="card-subtitle">${hoje.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })} | Presença: ${data.estatisticas.percentagem_presenca.toFixed(1)}%</p>
                        </div>
                        <div class="action-buttons-table">
                            <button class="btn btn-primary" id="exportAttendance">
                                <i class="fas fa-download"></i> Exportar
                            </button>
                        </div>
                    </div>
                    
                    ${data.frequencias && data.frequencias.length > 0 ?
                        `<table class="data-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Disciplina</th>
                                    <th>Estado</th>
                                    <th>Justificação</th>
                                    <th>Professor</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.frequencias.slice(0, 20).map(freq => `
                                    <tr>
                                        <td>${new Date(freq.data_aula).toLocaleDateString('pt-PT')}</td>
                                        <td>${freq.disciplina_nome || '--'}</td>
                                        <td>
                                            ${freq.status === 'presente' ? '<span class="badge badge-success">Presente</span>' :
                                              freq.status === 'falta' ? '<span class="badge badge-danger">Falta</span>' :
                                              freq.status === 'justificado' ? '<span class="badge badge-warning">Justificado</span>' :
                                              '<span class="badge badge-info">Atraso</span>'}
                                        </td>
                                        <td>${freq.justificativa || '--'}</td>
                                        <td>${freq.professor_nome || '--'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>` :
                        '<p style="text-align: center; padding: 2rem; color: var(--dark-text-secondary);">Nenhuma frequência registrada este mês</p>'
                    }
                    
                    ${data.estatisticas && data.estatisticas.total > 0 ?
                        `<div style="margin-top: 2rem; padding: 1.5rem; background-color: var(--dark-card); border-radius: var(--radius);">
                            <h4 style="font-weight: 600; margin-bottom: 1rem;">Estatísticas do Mês</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                <div>
                                    <div style="font-weight: 600; margin-bottom: 0.5rem;">Total de Aulas</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: 100%;"></div>
                                    </div>
                                    <div style="font-size: 0.85rem; margin-top: 0.5rem;">${data.estatisticas.total} aulas</div>
                                </div>
                                <div>
                                    <div style="font-weight: 600; margin-bottom: 0.5rem;">Presenças</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${(data.estatisticas.presentes / data.estatisticas.total) * 100}%; background: var(--accent);"></div>
                                    </div>
                                    <div style="font-size: 0.85rem; margin-top: 0.5rem;">${data.estatisticas.presentes} (${((data.estatisticas.presentes / data.estatisticas.total) * 100).toFixed(1)}%)</div>
                                </div>
                                <div>
                                    <div style="font-weight: 600; margin-bottom: 0.5rem;">Faltas</div>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${(data.estatisticas.faltas / data.estatisticas.total) * 100}%; background: var(--danger);"></div>
                                    </div>
                                    <div style="font-size: 0.85rem; margin-top: 0.5rem;">${data.estatisticas.faltas} (${((data.estatisticas.faltas / data.estatisticas.total) * 100).toFixed(1)}%)</div>
                                </div>
                            </div>
                        </div>` : ''
                    }
                </div>
            `;
        } catch (error) {
            return `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro ao carregar frequências: ${error.message}</span>
                </div>
            `;
        }
    }

    async function getAlunoDocuments() {
        try {
            const data = await api.obterDocumentosAluno();
            
            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title">Documentos e Recursos</h2>
                            <p class="card-subtitle">Documentos disponíveis para download</p>
                        </div>
                        <div class="action-buttons-table">
                            <input type="text" class="form-input" placeholder="Pesquisar documentos..." style="width: 200px;" id="searchDocuments">
                            <button class="btn btn-primary" id="searchDocumentsBtn">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                    </div>
                    
                    ${data.documentos && data.documentos.length > 0 ?
                        `<div class="library-grid">
                            ${data.documentos.slice(0, 12).map(doc => `
                                <div class="library-item">
                                    <div class="library-icon">
                                        ${getDocumentIcon(doc.tipo)}
                                    </div>
                                    <h3 style="font-weight: 600; margin-bottom: 0.5rem;">${doc.titulo}</h3>
                                    <p style="font-size: 0.9rem; color: var(--dark-text-secondary); margin-bottom: 1rem;">
                                        ${doc.descricao || 'Sem descrição'}
                                        ${doc.disciplina_nome ? `<br><small>${doc.disciplina_nome}</small>` : ''}
                                    </p>
                                    <div class="action-buttons-table">
                                        <button class="action-btn action-btn-view" onclick="previewDocument('${doc.id}')">
                                            <i class="fas fa-eye"></i> Ver
                                        </button>
                                        <button class="action-btn action-btn-download" onclick="downloadDocument('${doc.id}', '${doc.titulo}')">
                                            <i class="fas fa-download"></i> Download
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>` :
                        '<p style="text-align: center; padding: 2rem; color: var(--dark-text-secondary);">Nenhum documento disponível</p>'
                    }
                    
                    ${data.boletins && data.boletins.length > 0 ?
                        `<div style="margin-top: 2rem;">
                            <h3 style="font-weight: 600; margin-bottom: 1rem;">Boletins de Notas</h3>
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>Mês</th>
                                        <th>Disciplina</th>
                                        <th>Média</th>
                                        <th>Avaliações</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.boletins.map(boletim => `
                                        <tr>
                                            <td>${boletim.mes}</td>
                                            <td>${boletim.disciplina_nome}</td>
                                            <td><strong>${parseFloat(boletim.media_mensal).toFixed(1)}</strong></td>
                                            <td>${boletim.total_avaliacoes}</td>
                                            <td>
                                                <button class="action-btn action-btn-download" onclick="downloadBoletim('${boletim.mes}', '${boletim.disciplina_nome}')">
                                                    <i class="fas fa-download"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>` : ''
                    }
                </div>
            `;
        } catch (error) {
            return `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro ao carregar documentos: ${error.message}</span>
                </div>
            `;
        }
    }

    function getDocumentIcon(tipo) {
        switch(tipo) {
            case 'livro': return '<i class="fas fa-book"></i>';
            case 'artigo': return '<i class="fas fa-file-alt"></i>';
            case 'video': return '<i class="fas fa-video"></i>';
            case 'apostila': return '<i class="fas fa-file-pdf"></i>';
            case 'software': return '<i class="fas fa-download"></i>';
            default: return '<i class="fas fa-file"></i>';
        }
    }

    async function getAlunoMessages() {
        try {
            const data = await api.obterMensagensAluno();
            
            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title">Mensagens e Comunicações</h2>
                            <p class="card-subtitle">${data.total_nao_lidas} mensagens não lidas</p>
                        </div>
                        <button class="btn btn-primary" id="newMessageBtn">
                            <i class="fas fa-plus"></i> Nova Mensagem
                        </button>
                    </div>
                    
                    ${data.mensagens && data.mensagens.length > 0 ?
                        `<div style="display: grid; grid-template-columns: 300px 1fr; gap: 1.5rem; min-height: 500px;">
                            <div class="card" style="padding: 0;">
                                <div style="padding: 1.5rem; border-bottom: 1px solid var(--dark-border);">
                                    <input type="text" class="form-input" placeholder="Pesquisar mensagens..." id="searchMessages">
                                </div>
                                <div style="max-height: 400px; overflow-y: auto;" id="messagesList">
                                    ${data.mensagens.map(msg => `
                                        <div style="padding: 1rem; border-bottom: 1px solid var(--dark-border); cursor: pointer; ${!msg.lida ? 'background-color: var(--dark-card);' : ''}" 
                                             onclick="loadMessage(${msg.id})" data-message-id="${msg.id}">
                                            <div style="display: flex; align-items: center; gap: 1rem;">
                                                <div style="width: 40px; height: 40px; border-radius: 50%; background-color: var(--primary); display: flex; align-items: center; justify-content: center; color: white;">
                                                    <i class="fas fa-${msg.remetente_tipo === 'professor' ? 'user-tie' : 'user'}"></i>
                                                </div>
                                                <div style="flex: 1;">
                                                    <div style="font-weight: 600;">${msg.remetente_nome}</div>
                                                    <div style="font-size: 0.85rem; color: var(--dark-text-secondary);">${msg.assunto || msg.conteudo.substring(0, 30)}...</div>
                                                </div>
                                                ${!msg.lida ? '<span class="badge badge-danger" style="font-size: 0.7rem;">Nova</span>' : ''}
                                                <span style="font-size: 0.75rem; color: var(--dark-text-secondary);">${formatMessageDate(msg.data_envio)}</span>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div class="card" id="messageView">
                                <div style="text-align: center; padding: 3rem; color: var(--dark-text-secondary);">
                                    <i class="fas fa-envelope-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                                    <p>Selecione uma mensagem para visualizar</p>
                                </div>
                            </div>
                        </div>` :
                        '<p style="text-align: center; padding: 2rem; color: var(--dark-text-secondary);">Nenhuma mensagem disponível</p>'
                    }
                </div>
            `;
        } catch (error) {
            return `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro ao carregar mensagens: ${error.message}</span>
                </div>
            `;
        }
    }

    function formatMessageDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const dayDiff = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 0) {
            return 'Hoje';
        } else if (dayDiff === 1) {
            return 'Ontem';
        } else if (dayDiff < 7) {
            return `${dayDiff} dias atrás`;
        } else {
            return date.toLocaleDateString('pt-PT');
        }
    }

    async function getAlunoLibrary() {
        try {
            const data = await api.obterItensBiblioteca({ curso: 'Informática de Gestão' });
            
            return `
                <div class="card">
                    <div class="card-header">
                        <div>
                            <h2 class="card-title">Biblioteca Digital</h2>
                            <p class="card-subtitle">Materiais de estudo e recursos educativos</p>
                        </div>
                        <div class="action-buttons-table">
                            <input type="text" class="form-input" placeholder="Pesquisar recursos..." style="width: 200px;" id="searchLibrary">
                            <button class="btn btn-primary" id="searchLibraryBtn">
                                <i class="fas fa-search"></i>
                            </button>
                        </div>
                    </div>
                    
                    ${data.itens && data.itens.length > 0 ?
                        `<div class="library-grid">
                            ${data.itens.map(item => `
                                <div class="library-item">
                                    <div class="library-icon">
                                        ${getDocumentIcon(item.tipo)}
                                    </div>
                                    <h3 style="font-weight: 600; margin-bottom: 0.5rem;">${item.titulo}</h3>
                                    <p style="font-size: 0.9rem; color: var(--dark-text-secondary); margin-bottom: 1rem;">
                                        ${item.descricao || 'Sem descrição'}
                                        ${item.autor ? `<br><small>Autor: ${item.autor}</small>` : ''}
                                        ${item.tamanho ? `<br><small>Tamanho: ${item.tamanho}</small>` : ''}
                                    </p>
                                    <div class="action-buttons-table">
                                        <button class="action-btn action-btn-view" onclick="previewLibraryItem('${item.id}')">
                                            <i class="fas fa-eye"></i> Ver
                                        </button>
                                        <button class="action-btn action-btn-download" onclick="downloadLibraryItem('${item.id}', '${item.titulo}')">
                                            <i class="fas fa-download"></i> Download
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>` :
                        '<p style="text-align: center; padding: 2rem; color: var(--dark-text-secondary);">Nenhum recurso disponível</p>'
                    }
                    
                    ${data.total > data.itens.length ?
                        `<div style="text-align: center; margin-top: 2rem;">
                            <button class="btn btn-secondary" id="loadMoreLibrary">
                                <i class="fas fa-plus"></i> Carregar Mais (${data.total - data.itens.length} restantes)
                            </button>
                        </div>` : ''
                    }
                </div>
            `;
        } catch (error) {
            return `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro ao carregar biblioteca: ${error.message}</span>
                </div>
            `;
        }
    }

    async function getAlunoSettings() {
        try {
            const data = await api.obterPerfil();
            
            return `
                <div class="card">
                    <div class="card-header">
                        <h2 class="card-title">Configurações da Conta</h2>
                    </div>
                    
                    <div style="max-width: 600px; margin: 0 auto;">
                        <div style="display: grid; gap: 1.5rem;">
                            <div>
                                <h3 style="font-weight: 600; margin-bottom: 1rem;">Informações Pessoais</h3>
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="form-label">Nome Completo</label>
                                        <input type="text" class="form-input" id="nomeCompleto" value="${data.usuario.nome_completo}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Email</label>
                                        <input type="email" class="form-input" id="email" value="${data.usuario.email || ''}">
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="form-label">Telefone</label>
                                        <input type="tel" class="form-input" id="telefone" value="${data.usuario.telefone || ''}">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Data de Nascimento</label>
                                        <input type="date" class="form-input" id="dataNascimento" value="${data.usuario.data_nascimento || ''}">
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <h3 style="font-weight: 600; margin-bottom: 1rem;">Segurança</h3>
                                <div class="form-group">
                                    <label class="form-label">Palavra-passe Atual</label>
                                    <input type="password" class="form-input" id="senhaAtual" placeholder="Digite a palavra-passe atual">
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="form-label">Nova Palavra-passe</label>
                                        <input type="password" class="form-input" id="novaSenha" placeholder="Nova palavra-passe">
                                    </div>
                                    <div class="form-group">
                                        <label class="form-label">Confirmar Palavra-passe</label>
                                        <input type="password" class="form-input" id="confirmarSenha" placeholder="Confirmar palavra-passe">
                                    </div>
                                </div>
                            </div>
                            
                            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                                <button class="btn btn-primary" id="saveProfileBtn">
                                    <i class="fas fa-save"></i> Guardar Alterações
                                </button>
                                <button class="btn btn-secondary" id="cancelProfileBtn">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script>
                    document.getElementById('saveProfileBtn').addEventListener('click', async function() {
                        const nomeCompleto = document.getElementById('nomeCompleto').value;
                        const email = document.getElementById('email').value;
                        const telefone = document.getElementById('telefone').value;
                        const dataNascimento = document.getElementById('dataNascimento').value;
                        
                        const senhaAtual = document.getElementById('senhaAtual').value;
                        const novaSenha = document.getElementById('novaSenha').value;
                        const confirmarSenha = document.getElementById('confirmarSenha').value;
                        
                        try {
                            // Atualizar perfil
                            if (nomeCompleto || email || telefone || dataNascimento) {
                                const dadosPerfil = {};
                                if (nomeCompleto) dadosPerfil.nome_completo = nomeCompleto;
                                if (email) dadosPerfil.email = email;
                                if (telefone) dadosPerfil.telefone = telefone;
                                if (dataNascimento) dadosPerfil.data_nascimento = dataNascimento;
                                
                                await api.atualizarPerfil(dadosPerfil);
                            }
                            
                            // Alterar senha se fornecida
                            if (senhaAtual && novaSenha && confirmarSenha) {
                                if (novaSenha !== confirmarSenha) {
                                    throw new Error('As senhas não coincidem');
                                }
                                
                                await api.alterarSenha(senhaAtual, novaSenha, confirmarSenha);
                            }
                            
                            showAlert('Perfil atualizado com sucesso', 'success');
                        } catch (error) {
                            showAlert('Erro ao atualizar perfil: ' + error.message, 'danger');
                        }
                    });
                    
                    document.getElementById('cancelProfileBtn').addEventListener('click', function() {
                        // Recarregar a página de configurações
                        loadDashboardContent('${state.currentUserType}', 'settings');
                    });
                </script>
            `;
        } catch (error) {
            return `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Erro ao carregar configurações: ${error.message}</span>
                </div>
            `;
        }
    }

    // ========== FUNÇÕES GLOBAIS ==========
    window.previewDocument = async function(id) {
        try {
            const data = await api.obterItemBiblioteca(id);
            showAlert(`Pré-visualizando: ${data.item.titulo}`, 'info');
            // TODO: Implementar pré-visualização real
        } catch (error) {
            showAlert('Erro ao pré-visualizar documento', 'danger');
        }
    };

    window.downloadDocument = async function(id, titulo) {
        try {
            const data = await api.registrarDownloadItem(id);
            showAlert(`Baixando: ${titulo}`, 'success');
            // TODO: Implementar download real
        } catch (error) {
            showAlert('Erro ao baixar documento', 'danger');
        }
    };

    window.downloadBoletim = function(mes, disciplina) {
        showAlert(`Baixando boletim de ${mes} - ${disciplina}`, 'success');
        // TODO: Implementar download de boletim
    };

    window.loadMessage = async function(messageId) {
        try {
            // Marcar mensagem como lida
            await api.marcarMensagemComoLida(messageId);
            
            // Atualizar interface
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.style.backgroundColor = '';
                const badge = messageElement.querySelector('.badge');
                if (badge) badge.remove();
            }
            
            // TODO: Carregar e exibir conteúdo da mensagem
            showAlert('Mensagem marcada como lida', 'success');
        } catch (error) {
            showAlert('Erro ao carregar mensagem', 'danger');
        }
    };

    window.previewLibraryItem = async function(id) {
        try {
            const data = await api.obterItemBiblioteca(id);
            showAlert(`Pré-visualizando: ${data.item.titulo}`, 'info');
            // TODO: Implementar pré-visualização real
        } catch (error) {
            showAlert('Erro ao pré-visualizar item', 'danger');
        }
    };

    window.downloadLibraryItem = async function(id, titulo) {
        try {
            const data = await api.registrarDownloadItem(id);
            showAlert(`Baixando: ${titulo}`, 'success');
            // TODO: Implementar download real
        } catch (error) {
            showAlert('Erro ao baixar item', 'danger');
        }
    };

    // ========== VERIFICAÇÃO INICIAL ==========
    async function verificarAutenticacao() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (token && user) {
            try {
                const resultado = await api.verificarToken();
                
                if (resultado) {
                    state.currentUser = JSON.parse(user);
                    state.currentUserType = state.currentUser.tipo;
                    state.isLoggedIn = true;
                    state.token = token;
                    
                    // Esconder navegação
                    if (navLinksContainer) {
                        navLinksContainer.classList.add('hidden');
                    }
                    
                    // Redirecionar para dashboard
                    redirectToDashboard(state.currentUserType, state.currentUser);
                }
            } catch (error) {
                // Token inválido, limpar localStorage
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
    }

    // Inicializar sistema
    setupActionButtons();
    setupLogoutButtons();
    verificarAutenticacao();
});