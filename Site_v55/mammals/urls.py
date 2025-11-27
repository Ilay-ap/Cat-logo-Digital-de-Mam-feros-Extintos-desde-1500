from django.urls import path
from . import views

app_name = 'mammals'

urlpatterns = [
    # Páginas públicas
    path('', views.index, name='index'),
    path('mammal/<int:pk>/', views.mammal_detail, name='detail'),
    path('about/', views.about, name='about'),
    path('search/', views.search, name='search'),
    path('global-map/', views.global_map, name='global_map'),
    path('global-map-data/', views.global_map_data, name='global_map_data'),
    path('offline/', views.offline, name='offline'),
    
    # Favoritos
    path('favorites/', views.favorites_view, name='favorites'),
    path('favorite/<int:mammal_id>/toggle/', views.toggle_favorite, name='toggle_favorite'),
    
    # Comentários
    path('comment/<int:mammal_id>/add/', views.add_comment, name='add_comment'),
    path('comment/<int:comment_id>/delete/', views.delete_comment, name='delete_comment'),
    
    # Admin - Mamíferos
    path('admin/mammals/', views.admin_mammals, name='admin_mammals'),
    path('admin/mammals/add/', views.admin_add_mammal, name='admin_add_mammal'),
    path('admin/mammals/<int:pk>/edit/', views.admin_edit_mammal, name='admin_edit_mammal'),
    path('admin/mammals/<int:pk>/delete/', views.admin_delete_mammal, name='admin_delete_mammal'),
    
    # Admin - Usuários
    path('admin/users/', views.admin_users, name='admin_users'),
    path('admin/users/<int:user_id>/toggle_admin/', views.admin_toggle_admin, name='admin_toggle_admin'),
    path('admin/users/<int:user_id>/delete/', views.admin_delete_user, name='admin_delete_user'),
]

