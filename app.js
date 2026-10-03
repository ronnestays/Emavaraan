document.addEventListener('DOMContentLoaded', () => {
    const steps = Array.from(document.querySelectorAll('.form-step'));
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const submitBtn = document.getElementById('submit-btn');
    const resetBtn = document.getElementById('reset-btn');
    const progressBar = document.getElementById('progress-bar');
    const stepIndicator = document.getElementById('step-indicator');
    const form = document.getElementById('questionnaire-form');
    
    let currentStep = 0;
    const STORAGE_KEY = 'studiognails_questionnaire_data';

    // Load data from localStorage
    function loadSavedData() {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            const data = JSON.parse(savedData);
            Object.keys(data).forEach(key => {
                const inputs = form.querySelectorAll(`[name="${key}"]`);
                if (!inputs.length) return;
                
                const type = inputs[0].type;
                if (type === 'file') return; // Do not try to restore file inputs
                
                if (type === 'radio') {
                    const matchedInput = Array.from(inputs).find(input => input.value === data[key]);
                    if (matchedInput) {
                        matchedInput.checked = true;
                        matchedInput.closest('label').classList.add('selected');
                    }
                } else {
                    inputs[0].value = data[key];
                }
            });
        }
    }

    // Save data to localStorage
    function saveFormState() {
        const formData = new FormData(form);
        const data = {};
        for (const [key, value] of formData.entries()) {
            if (!(value instanceof File)) {
                data[key] = value;
            }
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // Add event listeners to all inputs to save state
    form.addEventListener('input', saveFormState);
    form.addEventListener('change', saveFormState);

    // Initialize Radio Buttons Styling
    const radioInputs = document.querySelectorAll('input[type="radio"]');
    radioInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            // Remove selected class from all in the same group
            const groupName = e.target.name;
            const groupInputs = document.querySelectorAll(`input[name="${groupName}"]`);
            groupInputs.forEach(inp => {
                inp.closest('label').classList.remove('selected');
            });
            // Add to current
            if (e.target.checked) {
                e.target.closest('label').classList.add('selected');
            }
        });
    });

    // Slider Logic
    const adBudgetSlider = document.getElementById('adBudget');
    const adBudgetDisplay = document.getElementById('adBudgetDisplay');

    function updateSliderDisplay(input) {
        if(!input || !adBudgetDisplay) return;
        const val = parseInt(input.value);
        adBudgetDisplay.textContent = val.toLocaleString('en-IN');
        
        // Update slider track background
        const min = input.min ? parseInt(input.min) : 0;
        const max = input.max ? parseInt(input.max) : 25000;
        const percentage = ((val - min) / (max - min)) * 100;
        input.style.background = `linear-gradient(to right, var(--accent-color) ${percentage}%, rgba(0, 0, 0, 0.1) ${percentage}%)`;
    }

    if(adBudgetSlider) {
        adBudgetSlider.addEventListener('input', (e) => {
            updateSliderDisplay(e.target);
            saveFormState();
        });
    }

    function updateForm() {
        // Show current step, hide others
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === currentStep);
        });

        // Update progress bar
        const progressPercentage = ((currentStep) / (steps.length - 1)) * 100;
        progressBar.style.width = `${progressPercentage === 0 ? 25 : progressPercentage}%`;

        // Update indicator
        stepIndicator.textContent = `Section ${currentStep + 1} of ${steps.length}`;

        // Toggle buttons
        if (currentStep === 0) {
            prevBtn.classList.add('hidden');
        } else {
            prevBtn.classList.remove('hidden');
        }

        if (currentStep === steps.length - 1) {
            nextBtn.classList.add('hidden');
            submitBtn.classList.remove('hidden');
        } else {
            nextBtn.classList.remove('hidden');
            submitBtn.classList.add('hidden');
        }
    }

    function validateStep() {
        const currentStepEl = steps[currentStep];
        const inputs = currentStepEl.querySelectorAll('input[required], textarea[required]');
        let isValid = true;

        inputs.forEach(input => {
            if (input.type === 'radio') {
                const groupName = input.name;
                const isChecked = currentStepEl.querySelector(`input[name="${groupName}"]:checked`);
                const options = currentStepEl.querySelectorAll(`input[name="${groupName}"]`);
                
                if (!isChecked) {
                    isValid = false;
                    options.forEach(opt => opt.closest('label').classList.add('input-error'));
                    setTimeout(() => {
                        options.forEach(opt => opt.closest('label').classList.remove('input-error'));
                    }, 500);
                }
            } else {
                if (!input.value.trim()) {
                    isValid = false;
                    input.classList.add('input-error');
                    setTimeout(() => {
                        input.classList.remove('input-error');
                    }, 500);
                }
            }
        });

        return isValid;
    }

    nextBtn.addEventListener('click', () => {
        if (validateStep()) {
            currentStep++;
            updateForm();
        }
    });

    prevBtn.addEventListener('click', () => {
        currentStep--;
        updateForm();
    });

    resetBtn.addEventListener('click', () => {
        if(confirm("Are you sure you want to reset all your answers?")) {
            localStorage.removeItem(STORAGE_KEY);
            form.reset();
            const selectedOptions = document.querySelectorAll('label.selected');
            selectedOptions.forEach(opt => opt.classList.remove('selected'));
            currentStep = 0;
            updateForm();
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validateStep()) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert file to base64
        const fileInput = document.getElementById('paymentScreenshot');
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
            });
            data.paymentScreenshot = {
                filename: file.name,
                content: base64
            };
        } else {
            delete data.paymentScreenshot; // Remove empty file object if no file selected
        }
        
        // Show loading state
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = 'Sending...';
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Fire confetti
                var duration = 3 * 1000;
                var animationEnd = Date.now() + duration;
                var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

                function randomInRange(min, max) {
                    return Math.random() * (max - min) + min;
                }

                var interval = setInterval(function() {
                    var timeLeft = animationEnd - Date.now();

                    if (timeLeft <= 0) {
                        return clearInterval(interval);
                    }

                    var particleCount = 50 * (timeLeft / duration);
                    confetti({
                        ...defaults, particleCount,
                        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
                    });
                    confetti({
                        ...defaults, particleCount,
                        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
                    });
                }, 250);

                // Show success Swal
                Swal.fire({
                    title: 'Sent Successfully!',
                    text: 'Your responses have been recorded and sent to our team.',
                    icon: 'success',
                    confirmButtonText: 'Awesome!',
                    confirmButtonColor: '#4cd137',
                    background: 'rgba(255, 255, 255, 0.9)',
                    backdrop: `rgba(0,0,0,0.4)`
                }).then(() => {
                    // Reset form after success
                    localStorage.removeItem(STORAGE_KEY);
                    form.reset();
                    const selectedOptions = document.querySelectorAll('label.selected');
                    selectedOptions.forEach(opt => opt.classList.remove('selected'));
                    currentStep = 0;
                    updateForm();
                });
                
            } else {
                throw new Error(result.message || 'Something went wrong');
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            Swal.fire({
                title: 'Error!',
                text: error.message || 'There was an issue sending your responses. Please try again later.',
                icon: 'error',
                confirmButtonText: 'Okay',
                confirmButtonColor: '#ff4757'
            });
        } finally {
            // Restore button state
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    });

    // Initialize
    loadSavedData();
    if(adBudgetSlider) updateSliderDisplay(adBudgetSlider);
    updateForm();
});

// Global function to copy UPI ID
window.copyUPI = function() {
    const textToCopy = document.getElementById('upi-id-text').innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
        const btn = document.querySelector('.btn-copy');
        const originalIcon = btn.innerHTML;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        btn.style.background = '#4cd137';
        btn.style.color = '#fff';
        btn.style.borderColor = '#4cd137';
        setTimeout(() => {
            btn.innerHTML = originalIcon;
            btn.style.background = 'transparent';
            btn.style.color = '#2d3223';
            btn.style.borderColor = 'rgba(0,0,0,0.2)';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy!', err);
    });
};
