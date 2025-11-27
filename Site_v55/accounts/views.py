from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.utils.translation import get_language, activate
from .models import UserProfile


def register_view(request):
    """View para registro de novos usuários"""
    if request.user.is_authenticated:
        return redirect('mammals:index')
    
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        password_confirm = request.POST.get('password_confirm', '')
        
        # Validações
        if not username or not email or not password:
            messages.error(request, 'Por favor, preencha todos os campos.')
            return render(request, 'accounts/register.html')
        
        if password != password_confirm:
            messages.error(request, 'As senhas não coincidem.')
            return render(request, 'accounts/register.html')
        
        if len(password) < 6:
            messages.error(request, 'A senha deve ter no mínimo 6 caracteres.')
            return render(request, 'accounts/register.html')
        
        if User.objects.filter(username=username).exists():
            messages.error(request, 'Este nome de usuário já está em uso.')
            return render(request, 'accounts/register.html')
        
        if User.objects.filter(email=email).exists():
            messages.error(request, 'Este email já está cadastrado.')
            return render(request, 'accounts/register.html')
        
        # Criar usuário
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password
            )
            
            # Criar perfil (get_or_create para evitar duplicação)
            UserProfile.objects.get_or_create(user=user, defaults={'is_admin': False})
            
            # Salvar idioma atual antes do login
            current_language = get_language()
            
            # Fazer login automático
            login(request, user)
            
            # Restaurar idioma após login
            activate(current_language)
            request.session['django_language'] = current_language
            
            messages.success(request, f'Bem-vindo, {username}! Sua conta foi criada com sucesso.')
            return redirect('mammals:index')
        
        except Exception as e:
            messages.error(request, f'Erro ao criar conta: {str(e)}')
            return render(request, 'accounts/register.html')
    
    return render(request, 'accounts/register.html')


def login_view(request):
    """View para login de usuários"""
    if request.user.is_authenticated:
        return redirect('mammals:index')
    
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        remember = request.POST.get('remember', False)
        
        if not username or not password:
            messages.error(request, 'Por favor, preencha todos os campos.')
            return render(request, 'accounts/login.html')
        
        user = authenticate(request, username=username, password=password)
        
        if user is not None:
            # Salvar idioma atual antes do login
            current_language = get_language()
            
            login(request, user)
            
            # Restaurar idioma após login
            activate(current_language)
            request.session['django_language'] = current_language
            
            # Configurar duração da sessão
            if not remember:
                request.session.set_expiry(0)  # Expira ao fechar o navegador
            
            messages.success(request, f'Bem-vindo, {user.username}!')
            
            # Redirecionar para a página solicitada ou para o index
            next_page = request.GET.get('next', 'mammals:index')
            return redirect(next_page)
        else:
            messages.error(request, 'Usuário ou senha incorretos.')
    
    return render(request, 'accounts/login.html')


def logout_view(request):
    """View para logout de usuários"""
    # Salvar idioma atual antes do logout
    current_language = get_language()
    
    logout(request)
    
    # Restaurar idioma após logout
    activate(current_language)
    request.session['django_language'] = current_language
    
    messages.info(request, 'Você saiu da sua conta.')
    return redirect('mammals:index')


@login_required
def profile_view(request):
    """View para visualizar perfil do usuário"""
    user_profile, created = UserProfile.objects.get_or_create(user=request.user)
    
    context = {
        'user_profile': user_profile,
        'comment_count': request.user.comments.count(),
        'favorite_count': request.user.favorites.count(),
    }
    
    return render(request, 'accounts/profile.html', context)


@login_required
def edit_profile_view(request):
    """View para editar perfil do usuário"""
    user_profile, created = UserProfile.objects.get_or_create(user=request.user)
    
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        current_password = request.POST.get('current_password', '')
        new_password = request.POST.get('new_password', '')
        new_password_confirm = request.POST.get('new_password_confirm', '')
        
        # Validar username
        if username != request.user.username:
            if User.objects.filter(username=username).exists():
                messages.error(request, 'Este nome de usuário já está em uso.')
                return render(request, 'accounts/edit_profile.html')
            request.user.username = username
        
        # Validar email
        if email != request.user.email:
            if User.objects.filter(email=email).exists():
                messages.error(request, 'Este email já está cadastrado.')
                return render(request, 'accounts/edit_profile.html')
            request.user.email = email
        
        # Alterar senha se fornecida
        if new_password:
            if not current_password:
                messages.error(request, 'Por favor, informe sua senha atual.')
                return render(request, 'accounts/edit_profile.html')
            
            if not request.user.check_password(current_password):
                messages.error(request, 'Senha atual incorreta.')
                return render(request, 'accounts/edit_profile.html')
            
            if new_password != new_password_confirm:
                messages.error(request, 'As novas senhas não coincidem.')
                return render(request, 'accounts/edit_profile.html')
            
            if len(new_password) < 6:
                messages.error(request, 'A nova senha deve ter no mínimo 6 caracteres.')
                return render(request, 'accounts/edit_profile.html')
            
            request.user.set_password(new_password)
        
        try:
            request.user.save()
            messages.success(request, 'Perfil atualizado com sucesso!')
            return redirect('accounts:profile')
        except Exception as e:
            messages.error(request, f'Erro ao atualizar perfil: {str(e)}')
    
    return render(request, 'accounts/edit_profile.html')
