from fastapi import FastAPI, File, UploadFile, HTTPException, Query, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
import shutil
import aiofiles
from typing import List, Optional
from pathlib import Path

app = FastAPI(title="Image Server")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base directory for images
BASE_DIR = Path("images")
BASE_DIR.mkdir(parents=True, exist_ok=True)

# Mount the static files directory
app.mount("/static", StaticFiles(directory="images"), name="static")

def get_image_path(store_id: str, usage: str, category_path: str = "") -> Path:
    # Sanitization could be added here to prevent path traversal
    path = BASE_DIR / store_id / usage
    if category_path:
        path = path / category_path
    path.mkdir(parents=True, exist_ok=True)
    return path

@app.get("/")
def read_root():
    return {"message": "Image Server is running"}

@app.post("/upload")
async def upload_files(
    store_id: str = Form(...),
    usage: str = Form("general"),
    category: str = Form(""),
    files: List[UploadFile] = File(...)
):
    upload_path = get_image_path(store_id, usage, category)
    uploaded_urls = []

    for file in files:
        try:
            # Create a unique filename if needed, or overwrite. 
            # For now, we'll keep the original filename but we might want to sanitize it.
            filename = file.filename
            file_location = upload_path / filename
            
            async with aiofiles.open(file_location, 'wb') as out_file:
                content = await file.read()
                await out_file.write(content)
            
            # Construct the static URL
            # URL format: /static/{store_id}/{usage}/{category}/{filename}
            # Handle empty category path cleanly
            relative_path = f"{store_id}/{usage}"
            if category:
                relative_path += f"/{category}"
            relative_path += f"/{filename}"
            
            # Use raw string for the path component to avoid issues
            uploaded_urls.append(f"http://localhost:8001/static/{relative_path}")
            
        except Exception as e:
            return JSONResponse(status_code=500, content={"message": f"Failed to upload {file.filename}: {str(e)}"})

    return {"urls": uploaded_urls}

@app.get("/images/{store_id}")
def list_images(store_id: str):
    store_path = BASE_DIR / store_id
    if not store_path.exists():
        return {"images": []}
    
    images = []
    # Walk through the directory structure
    for root, dirs, files in os.walk(store_path):
        for file in files:
            if file.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                full_path = Path(root) / file
                # Calculate relative path from BASE_DIR for the URL
                rel_path = full_path.relative_to(BASE_DIR)
                
                # Extract usage and category from path
                # Path structure: images/store_id/usage/category/filename
                parts = rel_path.parts
                # parts[0] is store_id
                # parts[1] is usage (if exists)
                
                usage = "general"
                category = ""
                
                if len(parts) > 2:
                    usage = parts[1]
                    # Everything between usage and filename is category
                    if len(parts) > 3:
                        category = "/".join(parts[2:-1])
                
                url = f"http://localhost:8001/static/{rel_path.as_posix()}"
                
                images.append({
                    "name": file,
                    "url": url,
                    "usage": usage,
                    "category": category,
                    "size": full_path.stat().st_size,
                    "created": full_path.stat().st_ctime
                })
    
    return {"images": images}

@app.delete("/images")
def delete_image(path: str = Query(..., description="Relative path after /static/")):
    # Security check: ensure path doesn't traverse upwards
    if ".." in path:
        raise HTTPException(status_code=400, detail="Invalid path")
    
    file_path = BASE_DIR / path
    if file_path.exists() and file_path.is_file():
        file_path.unlink()
        return {"message": "Image deleted"}
    raise HTTPException(status_code=404, detail="Image not found")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)
