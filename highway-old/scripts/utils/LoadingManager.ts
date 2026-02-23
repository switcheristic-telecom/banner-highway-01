export class LoadingProgressManager {
  private progressFill: HTMLElement | null;
  private progressPercentage: HTMLElement | null;
  private loadingStatus: HTMLElement | null;
  private currentProgress: number = 0;
  private loadingStages: Map<string, number> = new Map();

  constructor() {
    this.progressFill = document.getElementById('progress-fill');
    this.progressPercentage = document.getElementById('progress-percentage');
    this.loadingStatus = document.getElementById('loading-status');
  }

  updateProgress(stage: string, progress: number) {
    this.loadingStages.set(stage, Math.min(100, Math.max(0, progress)));
    this.calculateTotalProgress();
  }

  private calculateTotalProgress() {
    if (this.loadingStages.size === 0) {
      this.setProgress(0);
      return;
    }

    let total = 0;
    this.loadingStages.forEach((value) => {
      total += value;
    });

    const average = total / this.loadingStages.size;
    this.setProgress(average);
  }

  private setProgress(progress: number) {
    this.currentProgress = Math.min(100, Math.max(0, progress));

    if (this.progressFill) {
      this.progressFill.style.width = `${this.currentProgress}%`;
    }

    if (this.progressPercentage) {
      this.progressPercentage.textContent = `${Math.round(
        this.currentProgress
      )}%`;
    }
  }

  setStatus(status: string) {
    if (this.loadingStatus) {
      this.loadingStatus.textContent = status;
    }
  }

  reset() {
    this.loadingStages.clear();
    this.setProgress(0);
    this.setStatus('Initializing...');
  }

  complete() {
    this.setProgress(100);
    this.setStatus('Loaded...');
  }
}

// Create a global instance
export const loadingManager = new LoadingProgressManager();
