"""
Middleware para inicialização automática do banco de dados
"""
import os
import json
from django.core.management import call_command


class AutoInitMiddleware:
    """Middleware que inicializa o banco automaticamente na primeira requisição"""
    
    _initialized = False
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Inicializar apenas uma vez
        if not AutoInitMiddleware._initialized:
            self._auto_init()
            AutoInitMiddleware._initialized = True
        
        response = self.get_response(request)
        return response
    
    def _auto_init(self):
        """Inicializa o banco de dados se necessário"""
        try:
            from mammals.models import Mammal
            
            # Verificar se já existe dados
            try:
                if Mammal.objects.exists():
                    return
            except:
                # Tabela não existe, precisa migrar
                pass
            
            print("\n" + "="*60)
            print("🔧 INICIALIZANDO BANCO DE DADOS AUTOMATICAMENTE")
            print("="*60)
            
            # Executar migrações com verbosity=1
            print("\n📊 Executando migrações...")
            call_command('migrate', verbosity=1, interactive=False)
            print("✅ Migrações concluídas!")
            
            # Importar dados
            print("\n📥 Importando espécies...")
            from django.conf import settings
            json_file = os.path.join(settings.BASE_DIR, 'mammals_complete.json')
            
            if os.path.exists(json_file):
                with open(json_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                mammals_data = data.get('mammals', [])
                count = 0
                
                for item in mammals_data:
                    try:
                        Mammal.objects.create(
                            common_name=item.get('common_name', ''),
                            binomial_name=item.get('binomial_name', ''),
                            description=item.get('description', ''),
                            distribution=item.get('distribution', ''),
                            habitat=item.get('habitat', ''),
                            extinction_causes=item.get('extinction_cause', ''),
                            taxonomy_order=item.get('order', ''),
                            image_filename=item.get('image_filename', ''),
                            continent=item.get('continent', '')
                        )
                        count += 1
                    except Exception as e:
                        pass
                
                print(f"✅ {count} espécies importadas!")
            
            print("\n" + "="*60)
            print(f"✅ PRONTO! {Mammal.objects.count()} espécies no banco")
            print("="*60 + "\n")
            
        except Exception as e:
            print(f"⚠️  Erro na inicialização: {e}")
            import traceback
            traceback.print_exc()
