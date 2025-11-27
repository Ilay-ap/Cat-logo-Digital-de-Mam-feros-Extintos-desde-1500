from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.http import JsonResponse, HttpResponseRedirect
from django.db.models import Q, Count
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.conf import settings
from django.utils.translation import get_language, gettext_lazy as _
from django.urls import reverse
from .models import Mammal, Comment, Favorite
from .decorators import admin_required
from .translation_service import TranslatedMammal
from accounts.models import UserProfile
import json
import os


def load_geocoding_data():
    """Carrega dados de geocodificação do arquivo JSON"""
    json_path = os.path.join(settings.BASE_DIR, 'mammals_complete.json')
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            # Criar dicionário indexado por ID (usar índice da lista como ID)
            result = {}
            for idx, mammal in enumerate(data.get('mammals', []), start=1):
                if 'coordinates' in mammal and mammal['coordinates']:
                    result[idx] = {
                        'id': idx,
                        'has_map': True,
                        'coordinates': mammal['coordinates']
                    }
            return result
    except Exception as e:
        print(f"Erro ao carregar dados de geocodificação: {e}")
        return {}


# Carregar dados de geocodificação uma vez
GEOCODING_DATA = load_geocoding_data()


def index(request):
    """Página inicial com lista de mamíferos"""
    # Otimizar query - carregar apenas campos necessários
    mammals_list = Mammal.objects.only(
        'id', 'common_name', 'binomial_name', 'description', 
        'image_filename', 'continent', 'taxonomy_order'
    ).all()
    
    # Paginação - 24 mamíferos por página
    paginator = Paginator(mammals_list, 24)
    page = request.GET.get('page', 1)
    
    try:
        mammals = paginator.page(page)
    except PageNotAnInteger:
        mammals = paginator.page(1)
    except EmptyPage:
        mammals = paginator.page(paginator.num_pages)
    
    # Traduzir mamíferos para o idioma atual
    current_lang = get_language()
    # Normalizar código de idioma (pt-br -> pt, en-us -> en)
    lang_code = current_lang.split('-')[0] if current_lang else 'pt'
    if lang_code != 'pt':
        mammals.object_list = [TranslatedMammal(m, current_lang) for m in mammals.object_list]
    
    # Obter favoritos do usuário se autenticado
    favorites = []
    if request.user.is_authenticated:
        favorites = list(request.user.favorites.values_list('mammal_id', flat=True))
    
    context = {
        'mammals': mammals,
        'favorites': favorites,
        'is_paginated': paginator.num_pages > 1,
    }
    
    return render(request, 'mammals/index.html', context)


def mammal_detail(request, pk):
    """Página de detalhes de um mamífero"""
    # Para os animais com dossiês completos, usar template especial
    if pk in [41, 55]:  # Nesophontes hypomicrus e Dusicyon avus
        return mammal_dossier(request, pk)
    
    # Otimizar query - carregar comentários com usuários em uma query
    mammal_obj = get_object_or_404(
        Mammal.objects.prefetch_related('comments__user'),
        pk=pk
    )
    
    # Traduzir mamífero para o idioma atual
    current_lang = get_language()
    # Normalizar código de idioma
    lang_code = current_lang.split('-')[0] if current_lang else 'pt'
    if lang_code != 'pt':
        mammal = TranslatedMammal(mammal_obj, current_lang)
    else:
        mammal = mammal_obj
    
    comments = mammal.mammal.comments.select_related('user').all() if hasattr(mammal, 'mammal') else mammal.comments.select_related('user').all()
    
    # Verificar se é favorito (sempre usar mammal_obj original)
    is_favorite = False
    if request.user.is_authenticated:
        is_favorite = Favorite.objects.filter(
            user=request.user,
            mammal=mammal_obj
        ).exists()
    
    # Obter coordenadas do arquivo JSON
    map_data = None
    geocoding_info = GEOCODING_DATA.get(pk)
    
    if geocoding_info and geocoding_info.get('has_map') and geocoding_info.get('coordinates'):
        coordinates = geocoding_info['coordinates']
        
        # Calcular centro do mapa
        if coordinates:
            avg_lat = sum(c['lat'] for c in coordinates) / len(coordinates)
            avg_lon = sum(c['lon'] for c in coordinates) / len(coordinates)
            
            # Calcular zoom baseado na dispersão
            if len(coordinates) == 1:
                zoom = 6
            else:
                lats = [c['lat'] for c in coordinates]
                lons = [c['lon'] for c in coordinates]
                lat_range = max(lats) - min(lats)
                lon_range = max(lons) - min(lons)
                max_range = max(lat_range, lon_range)
                
                if max_range > 100:
                    zoom = 2
                elif max_range > 50:
                    zoom = 3
                elif max_range > 20:
                    zoom = 4
                elif max_range > 10:
                    zoom = 5
                elif max_range > 5:
                    zoom = 6
                else:
                    zoom = 7
            
            map_data = {
                'coordinates': coordinates,
                'center': {'lat': avg_lat, 'lon': avg_lon},
                'zoom': zoom,
            }
    
    context = {
        'mammal': mammal,
        'comments': comments,
        'is_favorite': is_favorite,
        'map_data': json.dumps(map_data) if map_data else None,
    }
    
    return render(request, 'mammals/detail.html', context)


def about(request):
    """Página sobre o projeto"""
    return render(request, 'mammals/about.html')


@login_required
def favorites_view(request):
    """Página de favoritos do usuário"""
    favorites = request.user.favorites.select_related('mammal').all()
    
    # Traduzir mamíferos favoritos
    current_lang = get_language()
    # Normalizar código de idioma
    lang_code = current_lang.split('-')[0] if current_lang else 'pt'
    
    # Criar lista de mamíferos traduzidos para o template
    mammals_list = []
    for fav in favorites:
        if lang_code != 'pt':
            mammal = TranslatedMammal(fav.mammal, current_lang)
        else:
            mammal = fav.mammal
        mammals_list.append({
            'favorite': fav,
            'mammal': mammal
        })
    
    context = {
        'favorites': mammals_list,
    }
    
    return render(request, 'mammals/favorites.html', context)


def search(request):
    """Endpoint de busca/filtragem (AJAX) - CORRIGIDO"""
    query = request.GET.get('q', '').strip()
    region_filter = request.GET.get('region', '').strip()
    taxonomy_filter = request.GET.get('taxonomy', '').strip()
    
    # Otimizar query - carregar apenas campos necessários
    mammals = Mammal.objects.only(
        'id', 'common_name', 'binomial_name', 'description',
        'image_filename', 'continent', 'taxonomy_order'
    ).all()  # IMPORTANTE: .all() para retornar todos quando não há filtros
    
    # Aplicar filtros apenas se existirem
    if query:
        mammals = mammals.filter(
            Q(common_name__icontains=query) |
            Q(binomial_name__icontains=query) |
            Q(description__icontains=query)
        )
    
    if region_filter and region_filter.lower() != 'all':
        mammals = mammals.filter(continent__iexact=region_filter)
    
    if taxonomy_filter and taxonomy_filter.upper() != 'ALL':
        mammals = mammals.filter(taxonomy_order__iexact=taxonomy_filter)
    
    # Preparar resultados com tratamento de erros
    results = []
    for mammal in mammals:
        try:
            # Usar short_description se existir, senão description truncada
            description = getattr(mammal, 'short_description', None)
            if not description:
                description = mammal.description[:200] if mammal.description else ''
            
            results.append({
                'id': mammal.id,
                'common_name': mammal.common_name or '',
                'binomial_name': mammal.binomial_name or '',
                'description': description,
                'image_filename': mammal.image_filename or '',
                'continent': mammal.continent or '',
                'taxonomy_order': mammal.taxonomy_order or '',
            })
        except Exception as e:
            # Log erro mas continua processando
            print(f"Erro ao processar mammal {mammal.id}: {e}")
            continue
    
    return JsonResponse(results, safe=False)


# ============================================================================
# ADMIN VIEWS - CRUD de Mamíferos
# ============================================================================

@admin_required
def admin_mammals(request):
    """Página administrativa de mamíferos"""
    mammals = Mammal.objects.all()
    
    context = {
        'mammals': mammals,
    }
    
    return render(request, 'admin_panel/mammals.html', context)


@admin_required
def admin_add_mammal(request):
    """Adicionar novo mamífero"""
    if request.method == 'POST':
        common_name = request.POST.get('common_name', '').strip()
        binomial_name = request.POST.get('binomial_name', '').strip()
        description = request.POST.get('description', '').strip()
        habitat = request.POST.get('habitat', '').strip()
        distribution = request.POST.get('distribution', '').strip()
        extinction_causes = request.POST.get('extinction_causes', '').strip()
        image_filename = request.POST.get('image_filename', '').strip()
        continent = request.POST.get('continent', '').strip()
        taxonomy_order = request.POST.get('taxonomy_order', '').strip()
        
        if not common_name or not binomial_name:
            messages.error(request, 'Nome comum e nome científico são obrigatórios.')
            return render(request, 'admin_panel/mammal_form.html', {'action': 'add'})
        
        try:
            Mammal.objects.create(
                common_name=common_name,
                binomial_name=binomial_name,
                description=description,
                habitat=habitat,
                distribution=distribution,
                extinction_causes=extinction_causes,
                image_filename=image_filename,
                continent=continent,
                taxonomy_order=taxonomy_order
            )
            messages.success(request, 'Mamífero adicionado com sucesso!')
            return redirect('mammals:admin_mammals')
        except ValueError as e:
            messages.error(request, f'Erro de validação: {str(e)}')
        except Exception as e:
            messages.error(request, f'Erro ao adicionar mamífero: {str(e)}')
    
    return render(request, 'admin_panel/mammal_form.html', {'action': 'add'})


@admin_required
def admin_edit_mammal(request, pk):
    """Editar mamífero existente"""
    mammal = get_object_or_404(Mammal, pk=pk)
    
    if request.method == 'POST':
        mammal.common_name = request.POST.get('common_name', '').strip()
        mammal.binomial_name = request.POST.get('binomial_name', '').strip()
        mammal.description = request.POST.get('description', '').strip()
        mammal.habitat = request.POST.get('habitat', '').strip()
        mammal.distribution = request.POST.get('distribution', '').strip()
        mammal.extinction_causes = request.POST.get('extinction_causes', '').strip()
        mammal.image_filename = request.POST.get('image_filename', '').strip()
        mammal.continent = request.POST.get('continent', '').strip()
        mammal.taxonomy_order = request.POST.get('taxonomy_order', '').strip()
        
        if not mammal.common_name or not mammal.binomial_name:
            messages.error(request, 'Nome comum e nome científico são obrigatórios.')
            return render(request, 'admin_panel/mammal_form.html', {
                'mammal': mammal,
                'action': 'edit'
            })
        
        try:
            mammal.save()
            messages.success(request, 'Mamífero atualizado com sucesso!')
            return redirect('mammals:admin_mammals')
        except ValueError as e:
            messages.error(request, f'Erro de validação: {str(e)}')
        except Exception as e:
            messages.error(request, f'Erro ao atualizar mamífero: {str(e)}')
    
    return render(request, 'admin_panel/mammal_form.html', {
        'mammal': mammal,
        'action': 'edit'
    })


@admin_required
def admin_delete_mammal(request, pk):
    """Deletar mamífero"""
    if request.method == 'POST':
        mammal = get_object_or_404(Mammal, pk=pk)
        
        try:
            mammal.delete()
            messages.success(request, 'Mamífero removido com sucesso!')
        except Exception as e:
            messages.error(request, f'Erro ao remover mamífero: {str(e)}')
    
    return redirect('mammals:admin_mammals')


# ============================================================================
# ADMIN VIEWS - Gestão de Usuários
# ============================================================================

@admin_required
def admin_users(request):
    """Página administrativa de usuários"""
    users = User.objects.select_related('profile').annotate(
        comment_count=Count('comments', distinct=True),
        favorite_count=Count('favorites', distinct=True)
    ).order_by('-date_joined')
    
    context = {
        'users': users,
    }
    
    return render(request, 'admin_panel/users.html', context)


@admin_required
def admin_toggle_admin(request, user_id):
    """Alternar status de administrador"""
    if request.method == 'POST':
        if user_id == request.user.id:
            messages.error(request, 'Você não pode alterar seu próprio status de administrador.')
            return redirect('mammals:admin_users')
        
        user = get_object_or_404(User, pk=user_id)
        profile, created = UserProfile.objects.get_or_create(user=user)
        
        try:
            profile.is_admin = not profile.is_admin
            profile.save()
            
            status_text = 'administrador' if profile.is_admin else 'usuário comum'
            messages.success(request, f'Usuário alterado para {status_text}.')
        except Exception as e:
            messages.error(request, f'Erro ao atualizar usuário: {str(e)}')
    
    return redirect('mammals:admin_users')


@admin_required
def admin_delete_user(request, user_id):
    """Deletar usuário"""
    if request.method == 'POST':
        if user_id == request.user.id:
            messages.error(request, 'Você não pode deletar sua própria conta.')
            return redirect('mammals:admin_users')
        
        user = get_object_or_404(User, pk=user_id)
        
        try:
            user.delete()
            messages.success(request, 'Usuário removido com sucesso!')
        except Exception as e:
            messages.error(request, f'Erro ao remover usuário: {str(e)}')
    
    return redirect('mammals:admin_users')


# ============================================================================
# COMMENT VIEWS
# ============================================================================

@login_required
def add_comment(request, mammal_id):
    """Adicionar comentário a um mamífero"""
    if request.method == 'POST':
        mammal = get_object_or_404(Mammal, pk=mammal_id)
        content = request.POST.get('content', '').strip()
        scroll_pos = request.POST.get('scroll_pos', '0')
        
        if not content:
            messages.error(request, _('Comment cannot be empty.'))
            return HttpResponseRedirect(reverse('mammals:detail', args=[mammal_id]) + f'?scroll={scroll_pos}#comments-section')
        
        try:
            Comment.objects.create(
                mammal=mammal,
                user=request.user,
                content=content
            )
            messages.success(request, _('Comment added successfully!'))
        except Exception as e:
            messages.error(request, _('Error adding comment: {}').format(str(e)))
    
    return HttpResponseRedirect(reverse('mammals:detail', args=[mammal_id]) + f'?scroll={scroll_pos}#comments-section')


@login_required
def delete_comment(request, comment_id):
    """Deletar comentário"""
    if request.method == 'POST':
        comment = get_object_or_404(Comment, pk=comment_id)
        mammal_id = comment.mammal.id
        scroll_pos = request.POST.get('scroll_pos', '0')
        
        # Verificar se o usuário é o autor ou admin
        if comment.user == request.user or (hasattr(request.user, 'profile') and request.user.profile.is_admin):
            try:
                comment.delete()
                messages.success(request, _('Comment removed successfully!'))
            except Exception as e:
                messages.error(request, _('Error removing comment: {}').format(str(e)))
        else:
            messages.error(request, _('You do not have permission to delete this comment.'))
        
        return HttpResponseRedirect(reverse('mammals:detail', args=[mammal_id]) + f'?scroll={scroll_pos}#comments-section')
    
    return redirect('mammals:index')


# ============================================================================
# FAVORITE VIEWS
# ============================================================================

@login_required
def toggle_favorite(request, mammal_id):
    """Adicionar/remover favorito"""
    if request.method == 'POST':
        mammal = get_object_or_404(Mammal, pk=mammal_id)
        scroll_pos = request.POST.get('scroll_pos', '0')
        
        try:
            favorite = Favorite.objects.filter(user=request.user, mammal=mammal).first()
            
            if favorite:
                favorite.delete()
                messages.success(request, _('Removed from favorites.'))
            else:
                Favorite.objects.create(user=request.user, mammal=mammal)
                messages.success(request, _('Added to favorites!'))
                
        except Exception as e:
            messages.error(request, _('Error updating favorite: {}').format(str(e)))
        
        # Redirecionar mantendo scroll exato
        return HttpResponseRedirect(reverse('mammals:detail', args=[mammal_id]) + f'?scroll={scroll_pos}#taxonomy-section')
    
    return redirect('mammals:index')


# ============================================================================
# ERROR HANDLERS
# ============================================================================

def custom_404(request, exception=None):
    """Handler personalizado para erro 404"""
    return render(request, 'errors/404.html', status=404)


def custom_500(request):
    """Handler personalizado para erro 500"""
    return render(request, 'errors/500.html', status=500)


def global_map(request):
    """Página do mapa-múndi interativo com heatmap de espécies"""
    return render(request, 'mammals/global_map.html')


def global_map_data(request):
    """Endpoint JSON com dados de todas as espécies para o mapa global"""
    try:
        # Buscar todos os mamíferos do banco de dados - apenas campos necessários
        mammals = Mammal.objects.only(
            'id', 'common_name', 'binomial_name', 'continent', 'image_filename'
        ).all()
        
        # Estrutura para armazenar dados agregados por localização
        location_data = {}
        
        # Processar cada mamífero
        for mammal in mammals:
            geocoding_info = GEOCODING_DATA.get(mammal.pk)
            
            if not geocoding_info or not geocoding_info.get('coordinates'):
                continue
            
            # Calcular centro geográfico das coordenadas do mamífero
            coords = geocoding_info['coordinates']
            if not coords:
                continue
            
            # Calcular média das coordenadas para ter um ponto central
            avg_lat = sum(c.get('lat', 0) for c in coords) / len(coords)
            avg_lon = sum(c.get('lon', 0) for c in coords) / len(coords)
            
            # Arredondar MUITO para agrupar regiões (0 casas decimais = ~111km de precisão)
            lat_rounded = round(avg_lat, 0)
            lon_rounded = round(avg_lon, 0)
            location_key = f"{lat_rounded},{lon_rounded}"
            
            # Pegar nome da primeira localização como referência
            location_name = coords[0].get('location', 'Unknown')
            
            # Inicializar dados da localização se não existir
            if location_key not in location_data:
                location_data[location_key] = {
                    'lat': lat_rounded,
                    'lon': lon_rounded,
                    'location_name': location_name,
                    'species': [],
                    'count': 0
                }
            
            # Adicionar espécie à localização
            species_info = {
                'id': mammal.pk,
                'common_name': mammal.common_name,
                'binomial_name': mammal.binomial_name,
                'continent': mammal.continent or 'Unknown',
                'image_filename': mammal.image_filename or ''
            }
            
            # Evitar duplicatas
            if not any(s['id'] == mammal.pk for s in location_data[location_key]['species']):
                location_data[location_key]['species'].append(species_info)
                location_data[location_key]['count'] += 1
        
        # Converter para lista
        locations = list(location_data.values())
        
        # Calcular estatísticas
        total_locations = len(locations)
        total_species = sum(loc['count'] for loc in locations)
        max_concentration = max((loc['count'] for loc in locations), default=0)
        
        response_data = {
            'success': True,
            'locations': locations,
            'statistics': {
                'total_locations': total_locations,
                'total_species': total_species,
                'max_concentration': max_concentration
            }
        }
        
        return JsonResponse(response_data)
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': str(e)
        }, status=500)


def offline(request):
    """Página offline para PWA"""
    return render(request, 'offline.html')


def mammal_dossier(request, pk):
    """View para exibir dossiê científico completo do mamífero"""
    mammal = get_object_or_404(Mammal, pk=pk)
    
    # Determinar qual template de dossiê usar
    if pk == 41:  # Nesophontes hypomicrus
        template = 'mammals/nesophontes_full.html'
    elif pk == 55:  # Dusicyon avus
        template = 'mammals/dusicyon_full.html'
    else:
        # Para outros mamíferos, redirecionar para página normal
        return redirect('mammals:detail', pk=pk)
    
    # Buscar comentários
    comments = mammal.comments.select_related('user').all()
    
    # Verificar se é favorito
    is_favorite = False
    if request.user.is_authenticated:
        is_favorite = Favorite.objects.filter(
            user=request.user,
            mammal=mammal
        ).exists()
    
    context = {
        'mammal': mammal,
        'comments': comments,
        'is_favorite': is_favorite,
    }
    
    return render(request, template, context)
