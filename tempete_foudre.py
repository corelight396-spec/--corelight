import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import random

# Paramètres de l'animation
width, height = 600, 400
num_frames = 30
fps = 15

def generate_lightning_path(start_x, start_y):
    """Génère un chemin brisé pour un éclair."""
    path = [(start_x, start_y)]
    current_x, current_y = start_x, start_y
    while current_y < height:
        # L'éclair descend avec des variations horizontales
        next_y = current_y + random.randint(10, 30)
        next_x = current_x + random.randint(-40, 40)
        path.append((next_x, next_y))
        current_x, current_y = next_x, next_y
        
        # Chance de bifurcation
        if random.random() < 0.2:
            branch_path = generate_lightning_path(current_x, current_y)
            # On ne renvoie pas tout pour rester simple, mais on pourrait
    return path

frames = []

for i in range(num_frames):
    # Couleur de base : sombre (nuit d'orage)
    bg_color = (10, 10, 25)
    
    # Probabilité d'un flash (éclairement du ciel)
    is_flash = random.random() < 0.15
    if is_flash:
        bg_color = (40, 40, 70) # Ciel illuminé par l'éclair
        
    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Si flash, on dessine l'éclair principal
    if is_flash:
        start_x = random.randint(50, width - 50)
        lightning_points = generate_lightning_path(start_x, 0)
        
        # Dessiner l'éclair (plusieurs fois pour l'épaisseur et l'éclat)
        # 1. Halo extérieur (flou)
        draw.line(lightning_points, fill=(100, 100, 255), width=6)
        # 2. Cœur blanc brillant
        draw.line(lightning_points, fill=(255, 255, 255), width=2)
        
        # Appliquer un léger flou pour l'effet de lumière si nécessaire
        img = img.filter(ImageFilter.GaussianBlur(radius=0.5))

    frames.append(img)

# Sauvegarde en GIF
gif_path = "tempete_foudre.gif"
frames[0].save(
    gif_path,
    save_all=True,
    append_images=frames[1:],
    duration=1000 // fps,
    loop=0
)