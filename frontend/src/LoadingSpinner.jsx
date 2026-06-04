import "./LoadingSpinner.css";

export default function LoadingSpinner({ text = "Loading..." }) {
  return (
    <div className="loading-page">
      <div className="loading-spinner"></div>
      <p>{text}</p>
    </div>
  );
}