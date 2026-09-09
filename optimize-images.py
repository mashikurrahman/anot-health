import os
import glob
from PIL import Image

image_dir = "images"
html_files = glob.glob("*.html")

for png_file in glob.glob(os.path.join(image_dir, "*.png")):
    base_name = os.path.basename(png_file)
    name_only, ext = os.path.splitext(base_name)
    webp_name = name_only + ".webp"
    webp_path = os.path.join(image_dir, webp_name)
    
    # Convert and compress
    try:
        img = Image.open(png_file)
        img.save(webp_path, "webp", optimize=True, quality=80)
        print(f"Converted {base_name} to {webp_name}")
        
        # Update HTML files
        for html_file in html_files:
            with open(html_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Use basic string replacement since we just want to update the extensions
            if f"images/{base_name}" in content:
                content = content.replace(f"images/{base_name}", f"images/{webp_name}")
                with open(html_file, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"  -> Updated {html_file}")
                
    except Exception as e:
        print(f"Failed to convert {base_name}: {e}")

print("Image optimization complete.")
