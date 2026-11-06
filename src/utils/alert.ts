type AlertType = 'alert' | 'confirm';

export interface AlertRequest {
  id: string;
  type: AlertType;
  title: string;
  message?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

type Listener = (req: AlertRequest | null) => void;

let current: AlertRequest | null = null;
const queue: AlertRequest[] = [];
let listener: Listener = () => { };

const notify = () => listener(current);

const dispatch = (req: AlertRequest) => {
  if (current) {
    queue.push(req);
  } else {
    current = req;
    notify();
  }
};

export const subscribeToAlerts = (cb: Listener) => {
  listener = cb;
  cb(current);
  return () => {
    listener = () => { };
  };
};

export const dismissCurrentAlert = () => {
  current = null;
  if (queue.length > 0) {
    current = queue.shift() || null;
  }
  notify();
};

export const showAlert = (title: string, message?: string) => {
  dispatch({
    id: `alert_${Date.now()}_${Math.random()}`,
    type: 'alert',
    title,
    message,
  });
};

export const showConfirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  dispatch({
    id: `confirm_${Date.now()}_${Math.random()}`,
    type: 'confirm',
    title,
    message,
    onConfirm,
    onCancel,
  });
};
