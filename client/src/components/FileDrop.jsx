import { UploadCloud } from "lucide-react";

function FileDrop() {
    return (
        <div className="border-2 border-dashed rounded-xl p-12 text-center">
            <UploadCloud
                size={60}
                className="mx-auto mb-4"
            />

            <h3 className="text-xl font-semibold">
                Drag & Drop File
            </h3>

            <p className="text-zinc-400 mt-2">
                Maximum 50MB
            </p>

            <button className="mt-6 px-5 py-2 rounded-lg bg-white text-black">
                Select File
            </button>
        </div>
    );
}

export default FileDrop;