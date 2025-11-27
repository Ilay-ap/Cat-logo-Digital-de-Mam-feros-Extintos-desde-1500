#!/bin/bash

# Script de inicialização do banco de dados
# Site V41 - Catálogo de Mamíferos Extintos

echo "🚀 Iniciando configuração do banco de dados..."

# Remover banco antigo se existir
if [ -f "db.sqlite3" ]; then
    echo "⚠️  Removendo banco de dados antigo..."
    rm db.sqlite3
fi

# Remover migrations antigas (exceto __init__.py)
echo "🗑️  Limpando migrations antigas..."
find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
find . -path "*/migrations/*.pyc" -delete

# Criar novas migrations
echo "📝 Criando migrations..."
python3.11 manage.py makemigrations accounts
python3.11 manage.py makemigrations mammals

# Aplicar migrations
echo "⚡ Aplicando migrations..."
python3.11 manage.py migrate

# Criar superusuário (opcional)
echo ""
echo "✅ Banco de dados inicializado com sucesso!"
echo ""
echo "Para criar um superusuário, execute:"
echo "  python3.11 manage.py createsuperuser"
echo ""
echo "Para popular o banco com dados, execute:"
echo "  python3.11 manage.py loaddata mammals_data.json"
echo ""
