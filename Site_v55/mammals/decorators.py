from django.shortcuts import redirect
from django.contrib import messages
from functools import wraps


def admin_required(view_func):
    """
    Decorator para views que requerem privilégios de administrador.
    Verifica se o usuário está autenticado e se tem is_admin=True no perfil.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.warning(request, 'Por favor, faça login para acessar esta página.')
            return redirect('accounts:login')
        
        # Verificar se o usuário tem perfil e é admin
        if hasattr(request.user, 'profile') and request.user.profile.is_admin:
            return view_func(request, *args, **kwargs)
        
        messages.error(request, 'Acesso negado. Você precisa ser administrador.')
        return redirect('mammals:index')
    
    return wrapper

