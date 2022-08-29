import * as React from "react";
export const Button = ({ apiUrl }: { apiUrl?: string }) => {
  const [apiResponse, setApiResponse] = React.useState<{ data: string }>();
  if (!apiUrl) return <span>API URL not found</span>;
  return (
    <>
      <div>
        <span>API URL: {apiUrl}</span>
      </div>
      <br />
      <button
        onClick={() => {
          fetch(apiUrl)
            .then((response) => response.json())
            .then((json) => {
              setApiResponse(json);
            });
        }}
      >
        Click to get response from API
      </button>
      <br />
      <br />
      {apiResponse ? <div>Response: {JSON.stringify(apiResponse)}</div> : null}
    </>
  );
};
