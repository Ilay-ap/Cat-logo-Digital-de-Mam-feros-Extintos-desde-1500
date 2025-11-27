from django.db import models
from django.contrib.auth.models import User
from django.urls import reverse
from django.core.cache import cache


class Mammal(models.Model):
    """Modelo para mamíferos extintos"""
    common_name = models.CharField(
        max_length=200,
        verbose_name="Nome Comum",
        help_text="Nome popular do mamífero"
    )
    binomial_name = models.CharField(
        max_length=200,
        verbose_name="Nome Científico",
        help_text="Nome binomial (científico) do mamífero"
    )
    description = models.TextField(
        verbose_name="Descrição",
        help_text="Descrição detalhada do mamífero"
    )
    habitat = models.TextField(
        blank=True,
        null=True,
        verbose_name="Habitat",
        help_text="Habitat natural do mamífero"
    )
    distribution = models.TextField(
        blank=True,
        null=True,
        verbose_name="Distribução",
        help_text="Distribuição geográfica"
    )
    extinction_causes = models.TextField(
        blank=True,
        null=True,
        verbose_name="Causas da Extinção",
        help_text="Principais causas que levaram à extinção"
    )
    image_filename = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Nome do Arquivo de Imagem",
        help_text="Nome do arquivo de imagem na pasta static/images"
    )
    continent = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Continente",
        help_text="Continente onde o mamífero habitava"
    )
    taxonomy_order = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="Ordem Taxonômica",
        help_text="Ordem taxonômica do mamífero"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Mamífero Extinto"
        verbose_name_plural = "Mamíferos Extintos"
        ordering = ['common_name']
        indexes = [
            models.Index(fields=['common_name']),
            models.Index(fields=['continent']),
            models.Index(fields=['taxonomy_order']),
        ]

    def __str__(self):
        return f"{self.common_name} ({self.binomial_name})"

    def get_absolute_url(self):
        return reverse('mammals:detail', kwargs={'pk': self.pk})

    @property
    def short_description(self):
        """Retorna uma versão curta da descrição"""
        if len(self.description) > 200:
            return self.description[:200] + '...'
        return self.description
    
    def get_translation(self, language='en'):
        """Retorna tradução do mamífero (com cache)"""
        if language in ['pt', 'pt-br']:
            return {
                'description': self.description,
                'short_description': self.short_description,
                'habitat': self.habitat or '',
                'distribution': self.distribution or '',
                'extinction_causes': self.extinction_causes or '',
            }
        
        # Normalizar código de idioma
        lang_code = language.split('-')[0]
        
        # Tentar buscar no cache primeiro
        cache_key = f'mammal_translation_{self.pk}_{lang_code}'
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        # Buscar no banco de dados
        try:
            from .models_translation import MammalTranslation
            translation = MammalTranslation.objects.get(
                mammal=self,
                language=lang_code
            )
            result = {
                'description': translation.description,
                'short_description': translation.short_description,
                'habitat': translation.habitat,
                'distribution': translation.distribution,
                'extinction_causes': translation.extinction_causes,
            }
            # Cachear por 24 horas
            cache.set(cache_key, result, 60 * 60 * 24)
            return result
        except Exception:
            # Se não houver tradução, retornar original
            return {
                'description': self.description,
                'short_description': self.short_description,
                'habitat': self.habitat or '',
                'distribution': self.distribution or '',
                'extinction_causes': self.extinction_causes or '',
            }


class Comment(models.Model):
    """Modelo para comentários em mamíferos"""
    mammal = models.ForeignKey(
        Mammal,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name="Mamífero"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name="Usuário"
    )
    content = models.TextField(
        verbose_name="Conteúdo",
        help_text="Conteúdo do comentário"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Comentário"
        verbose_name_plural = "Comentários"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['mammal', '-created_at']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"Comentário de {self.user.username} em {self.mammal.common_name}"


class Favorite(models.Model):
    """Modelo para favoritos (relação N:N entre usuários e mamíferos)"""
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='favorites',
        verbose_name="Usuário"
    )
    mammal = models.ForeignKey(
        Mammal,
        on_delete=models.CASCADE,
        related_name='favorited_by',
        verbose_name="Mamífero"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Favoritado em")

    class Meta:
        verbose_name = "Favorito"
        verbose_name_plural = "Favoritos"
        ordering = ['-created_at']
        unique_together = ['user', 'mammal']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['mammal']),
        ]

    def __str__(self):
        return f"{self.user.username} favoritou {self.mammal.common_name}"


class Rating(models.Model):
    """Modelo para avaliações de mamíferos pelos usuários"""
    RATING_CHOICES = [
        (1, '1 estrela'),
        (2, '2 estrelas'),
        (3, '3 estrelas'),
        (4, '4 estrelas'),
        (5, '5 estrelas'),
    ]
    
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='ratings',
        verbose_name="Usuário"
    )
    mammal = models.ForeignKey(
        Mammal,
        on_delete=models.CASCADE,
        related_name='ratings',
        verbose_name="Mamífero"
    )
    score = models.IntegerField(
        choices=RATING_CHOICES,
        verbose_name="Pontuação",
        help_text="Avaliação de 1 a 5 estrelas"
    )
    review = models.TextField(
        blank=True,
        null=True,
        verbose_name="Comentário da Avaliação",
        help_text="Comentário opcional sobre a avaliação"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Criado em")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Atualizado em")

    class Meta:
        verbose_name = "Avaliação"
        verbose_name_plural = "Avaliações"
        ordering = ['-created_at']
        unique_together = ['user', 'mammal']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['mammal']),
            models.Index(fields=['score']),
        ]

    def __str__(self):
        return f"{self.user.username} avaliou {self.mammal.common_name} com {self.score} estrelas"
    
    @property
    def stars_display(self):
        """Retorna representação visual das estrelas"""
        return '⭐' * self.score + '☆' * (5 - self.score)
