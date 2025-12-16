from github import Github
import os
import logging
#from dotenv import load_dotenv  # Tidak perlu lagi
from pathlib import Path
import json
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Get the app root directory
APP_DIR = Path(__file__).resolve().parent.parent

class GitHubStorage:
    def __init__(self):
        # Inisiasi token langsung di sini
        self.token = "token anda"
        self.is_online = False
        
        try:
            if self.token:
                self.gh = Github(self.token)
                self.repo = self.gh.get_repo("nama_github/repo")
                self.is_online = True
                logger.info("Successfully connected to GitHub repository")
            else:
                logger.warning("GitHub token not found, running in offline mode")
        except Exception as e:
            logger.warning(f"Failed to connect to GitHub, running in offline mode: {str(e)}")

        # Setup cache
        self.cache_dir = APP_DIR / 'cache'
        self.cache_file = self.cache_dir / 'images_cache.json'
        self.cache_duration = timedelta(hours=1)  # Cache validity duration
        self.setup_cache()

    def setup_cache(self):
        """Initialize cache directory and file"""
        os.makedirs(self.cache_dir, exist_ok=True)
        if not self.cache_file.exists():
            self._write_cache({
                'last_sync': None,
                'images': {}
            })

    def _read_cache(self):
        """Read from cache file"""
        try:
            with open(self.cache_file, 'r') as f:
                return json.load(f)
        except:
            return {'last_sync': None, 'images': {}}

    def _write_cache(self, data):
        """Write to cache file"""
        with open(self.cache_file, 'w') as f:
            json.dump(data, f)

    def is_cache_valid(self):
        """Check if cache is still valid"""
        cache = self._read_cache()
        if not cache['last_sync']:
            return False
        
        last_sync = datetime.fromisoformat(cache['last_sync'])
        return datetime.now() - last_sync < self.cache_duration

    def upload_file(self, file_path):
        try:
            if not self.is_online:
                logger.info("Running in offline mode, saving locally only")
                return f"/static/images/{os.path.basename(file_path)}"

            # Log the attempt
            logger.info(f"Attempting to upload {file_path}")
            
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return None

            file_name = os.path.basename(file_path)
            
            with open(file_path, 'rb') as file:
                content = file.read()
            
            try:
                # Check if file exists
                existing_file = self.repo.get_contents(f"images/{file_name}")
                # Update existing file
                self.repo.update_file(
                    f"images/{file_name}",
                    f"Update {file_name}",
                    content,
                    existing_file.sha
                )
                logger.info(f"Updated existing file: {file_name}")
            except:
                # Create new file
                self.repo.create_file(
                    f"images/{file_name}",
                    f"Add {file_name}",
                    content
                )
                logger.info(f"Created new file: {file_name}")
            
            return f"https://raw.githubusercontent.com/nama_github/nama_repo/main/images/{file_name}"
            
        except Exception as e:
            logger.error(f"GitHub upload failed: {str(e)}")
            # Fallback to local path
            return f"/static/images/{os.path.basename(file_path)}"

    def ensure_images_directory(self):
        try:
            self.repo.get_contents("images")
        except:
            # Create images directory with a .gitkeep file
            self.repo.create_file(
                "images/.gitkeep",
                "Initialize images directory",
                ""
            )
            logger.info("Created images directory in repository")

    def sync_files(self, local_dir):
        """Enhanced sync with caching"""
        if not self.is_online:
            logger.info("Running in offline mode, using cached files")
            return
        
        # If cache is valid, skip sync
        if self.is_cache_valid():
            logger.info("Using cached images list")
            return
            
        try:
            self.ensure_images_directory()
            
            # Get current cache
            cache = self._read_cache()
            cache['images'] = {}
            
            contents = self.repo.get_contents("images")
            for content in contents:
                if content.name == '.gitkeep':
                    continue
                    
                file_name = content.name
                local_path = os.path.join(local_dir, file_name)
                github_url = f"https://raw.githubusercontent.com/nama_github/nama_repo/main/images/{file_name}"
                
                # Update cache
                cache['images'][file_name] = {
                    'local_path': local_path,
                    'github_url': github_url,
                    'sha': content.sha
                }
                
                # Download if not exists locally
                if not os.path.exists(local_path):
                    file_content = self.repo.get_contents(content.path).decoded_content
                    with open(local_path, 'wb') as f:
                        f.write(file_content)
                    logger.info(f"Downloaded {file_name} from GitHub")
            
            # Update cache timestamp
            cache['last_sync'] = datetime.now().isoformat()
            self._write_cache(cache)
            logger.info("Cache updated successfully")
                
        except Exception as e:
            logger.error(f"Sync failed: {str(e)}")

    def get_image_url(self, filename):
        """Get image URL from cache or fallback to local"""
        cache = self._read_cache()
        
        if filename in cache['images']:
            # Check if local file exists
            local_path = cache['images'][filename]['local_path']
            if os.path.exists(local_path):
                # Return normalized path without leading slash
                return f"static/images/{filename}"
                
            # If local doesn't exist but we're online, return GitHub URL
            if self.is_online:
                return cache['images'][filename]['github_url']
        
        # Fallback to normalized local path
        return f"static/images/{filename}"