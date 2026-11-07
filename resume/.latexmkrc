# Copy the compiled public PDF to the Astro public folder after every successful build.
# Only resume.pdf is copied: resume-phone.pdf contains the phone number and stays local.
$success_cmd = 'case "%D" in */resume.pdf|resume.pdf) cp "%D" "../public/Daan_Rosendal_Resume.pdf";; esac';
